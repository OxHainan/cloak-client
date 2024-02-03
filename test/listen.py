import pyinotify
import json
import argparse
import web3
from loguru import logger as LOG
from multiprocessing import Process
import time
import traceback
from hexbytes import HexBytes

def writeToFile(msg: dict):
    f = open("data/txs.txt", "a")
    f.write(json.dumps(msg) + "\n")
    f.close()

def writeState(msg: dict):
    f = open("data/state.txt", "a")
    f.write(json.dumps(msg) + "\n")
    f.close()

class Handler(object):
    def __init__(self, args):
        self.args = args
    
    def handle_receipt(self, msg):
        tx_hash = msg[:66]
        res = self.args.w3.eth.wait_for_transaction_receipt(tx_hash)
        LOG.info(tx_hash)
        split_time = msg[67:].split(',')
        parsed_time = {}
        for val in split_time:
            key, val = val.split(':')
            parsed_time[key.strip()] = int(val.strip())

        writeToFile({
            "name": "Sync",
            "id": tx_hash,
            "gasUsed": res["gasUsed"],
            "time": parsed_time
        })
    
    def handle_state(self, msg, name):
        split_msg = msg.split(',')
        parse_state = {}
        for val in split_msg:
            key, val = val.split(':')
            parse_state[key.strip()] = val.strip()
        writeState({
            "name": name,
            "args": parse_state
        })


    def handle_logs(self, msg):
        split_msg = msg.split('; ')
        if split_msg[0] == "tx":
            self.handle_receipt(split_msg[1])
        elif split_msg[0] == "get_export_state":
            self.handle_state(split_msg[1], "state")
        elif split_msg[0] == "sync_contract_escrow":
            self.handle_state(split_msg[1], "escrow")
        

class EventHandler(pyinotify.ProcessEvent):
    def __init__(self,cmd_args, *args, **kwargs):
        super(EventHandler, self).__init__(*args, **kwargs)
        self.args = cmd_args
        self.file = open(cmd_args.common_dir + "/sandbox_0/out", "r")
        self.file.seek(0, 2)
        self.decode_lines()

    def process_IN_MODIFY(self, event):
        self.decode_lines()

    def decode_lines(self):
        while line:= self.file.readline():
            pos = line.find("send: ")
            if pos == -1:
                continue
            new_line = line[pos + 6:]
            try:
                Handler(self.args).handle_logs(new_line)
            except Exception as e:
                traceback.print_exc()

def event_handler(args: argparse.Namespace):
    wm = pyinotify.WatchManager()
    handler =  EventHandler(args)
    notifier = pyinotify.Notifier(wm, handler)
    wm.add_watch(args.common_dir + "/sandbox_0/out", pyinotify.IN_MODIFY, rec = True)
    notifier.loop()

def log_event(args):
    p = Process(target=event_handler, args=(args,))
    p.start()
    time.sleep(1)
    return p

def run(args):
    args.w3 = web3.Web3(web3.HTTPProvider(args.blockchain_url))
    agent_proc = log_event(args)
    LOG.warning("Press Ctrl+C to shutdown the network")
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        if agent_proc:
            agent_proc.kill()
        LOG.info("Stopping listen process")


if __name__ == "__main__":

    def cli_args(add=lambda x: None, parser=None, accept_unknown=False):
        if parser is None:
            parser = argparse.ArgumentParser(
                formatter_class=argparse.ArgumentDefaultsHelpFormatter
            )

        parser.add_argument(
            "--blockchain-url",
            help="Connect to the blockchain",
            default="http://localhost:8545"
        )

        parser.add_argument(
            "--common-dir",
            help="CCF build file"
        )

        args = parser.parse_args()
        return args

    args = cli_args()
    run(args)
   