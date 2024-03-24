import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { BASE_NODE_PORT } from "../config";
import { Value, NodeState } from "../types";
import { sendglobalMessage, consensus1, consensus2 } from "../functions";
import { delay } from "../utils";

export async function node(
    nodeId: number, // the ID of the node
    N: number, // total number of nodes in the network
    F: number, // number of faulty nodes in the network
    initialValue: Value, // initial value of the node
    isFaulty: boolean, // true if the node is faulty, false otherwise
    nodesAreReady: () => boolean, // used to know if all nodes are ready to receive requests
    setNodeIsReady: (index: number) => void // this should be called when the node is started and ready to receive requests
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());

  let state: NodeState = {
    killed: false,
    x: initialValue,
    decided: false,
    k: 0
  };

  if (isFaulty) {
    state.x = null;
    state.decided = null;
    state.k = null;
  }

  let messagesStep1: Map<number, Value[]> = new Map();
  let messagesStep2: Map<number, Value[]> = new Map();

  // 1.
  // TODO implement this
  // this route allows retrieving the current status of the node
  node.get("/status", (req, res) => {
    if (isFaulty) {
      return res.status(500).send("faulty");
    } else {
      return res.status(200).send("live");
    }
  });

  // TODO implement this
  // get the current state of a node
  node.get("/getState", (req, res) => {
    if (isFaulty) {
      res.status(200).json(state);
    }
    else {
      if (!state.decided) {
        res.status(200).json(state);
      }
      else {
        state.k = state.k! - 1;
        res.status(200).json(state);
        state.k = state.k! + 1;
      }
    }
  });

  // TODO implement this
  // this route allows the node to receive messages from other nodes
  node.post("/message", (req: Request, res: Response) => {
    if (!isFaulty) {
      let { x, k, step } = req.body;

      if (step === 1 && !state.decided && !state.killed) {
        if (!messagesStep1.has(k)) {
          messagesStep1.set(k, []);
        }
        messagesStep1.get(k)!.push(x);
        if (messagesStep1.get(k)!.length >= N - F) {
          state.x = consensus1(messagesStep1.get(k)!, state, N);
          sendglobalMessage(2, state, N);
        }
      }

      if (step === 2 && !state.decided && !state.killed) {
        if (!messagesStep2.has(k)) {
          messagesStep2.set(k, []);
        }
        messagesStep2.get(k)!.push(x);
        if (messagesStep2.get(k)!.length >= N - F) {
          consensus2(messagesStep2.get(k)!, state, F);
          state.k = state.k! + 1;
          sendglobalMessage(1, state, N);
        }
      }
    }
    res.status(200).send("success");
  });

  // TODO implement this
  // this route is used to start the consensus algorithm
  node.get("/start", async (req, res) => {
    while (!nodesAreReady()) {
      await delay(10);
    }
    if (!isFaulty) {
      state.k = 1;
      sendglobalMessage(1, state, N);
    }
    return res.status(200).send("success");
  });

  // TODO implement this
  // this route is used to stop the consensus algorithm
  node.get("/stop", async (req, res) => {
    state.killed = true;
    res.status(200).send("killed");
  });

  // start the server
  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(
        `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
    );

    // the node is ready
    setNodeIsReady(nodeId);
  });

  return server;
}