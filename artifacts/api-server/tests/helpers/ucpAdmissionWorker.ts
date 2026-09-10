import { parentPort, workerData } from "node:worker_threads";
import { pool } from "@workspace/db";
import {
  admitUcpProfileResolution,
  setUcpPreAuthLimitForTests,
} from "../../src/lib/ucpNegotiation";

type AdmissionWorkerInput = {
  clientKey: string;
  worker: number;
  count: number;
};

const input = workerData as AdmissionWorkerInput;

try {
  setUcpPreAuthLimitForTests(true);
  const admissions: boolean[] = [];
  for (let index = 0; index < input.count; index += 1) {
    admissions.push(
      await admitUcpProfileResolution(
        `profile="https://worker-${input.worker}-agent-${index}.example/.well-known/ucp"`,
        input.clientKey,
      ),
    );
  }
  parentPort?.postMessage({ admissions });
} catch (error) {
  parentPort?.postMessage({
    error: error instanceof Error ? error.message : String(error),
  });
} finally {
  await pool.end();
}