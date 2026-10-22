// solver.worker.ts
// Runs generation and solution counting off the main thread.

import { generatePuzzle } from './generator'
import { solve } from './solver'
import type { WorkerRequest, WorkerResponse } from './solverClient'

const post = (msg: WorkerResponse) => self.postMessage(msg)

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data
  const data =
    req.kind === 'generate'
      ? generatePuzzle(req.seed, req.difficulty, req.unique)
      : solve(
          req.start,
          req.pieceIds,
          req.progress
            ? { ...req.options, onProgress: (progress) => post({ kind: 'progress', progress }) }
            : req.options,
        )
  post({ kind: 'result', data })
}
