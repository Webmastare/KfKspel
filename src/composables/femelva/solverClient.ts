// solverClient.ts
// Promise wrapper around solver.worker.ts. Each channel runs one job at a time; starting a
// new job on a channel kills the previous one, so stale counts never block fresh ones.

import type { Occupancy } from './board'
import type { DifficultyId, GeneratedPuzzle } from './generator'
import type { SolveOptions, SolveProgress, SolveResult } from './solver'

// Functions can't be posted to a worker
export type WorkerSolveOptions = Omit<SolveOptions, 'random' | 'onProgress'>

export type WorkerRequest =
  | { kind: 'generate'; seed: string; difficulty: DifficultyId; unique: boolean }
  | {
      kind: 'solve'
      start: Occupancy
      pieceIds: string[]
      options: WorkerSolveOptions
      progress: boolean
    }

export type WorkerResponse =
  | { kind: 'progress'; progress: SolveProgress }
  | { kind: 'result'; data: unknown }

export class CancelledError extends Error {}

export class SolverChannel {
  private worker: Worker | null = null
  private reject: ((err: Error) => void) | null = null

  generate(seed: string, difficulty: DifficultyId, unique: boolean) {
    return this.run<GeneratedPuzzle>({ kind: 'generate', seed, difficulty, unique })
  }

  solve(
    start: Occupancy,
    pieceIds: string[],
    options: WorkerSolveOptions,
    onProgress?: (progress: SolveProgress) => void,
  ) {
    // Plain copies: reactive proxies can't be posted to a worker
    return this.run<SolveResult>(
      {
        kind: 'solve',
        start: start.map((row) => [...row]),
        pieceIds: [...pieceIds],
        options,
        progress: !!onProgress,
      },
      onProgress,
    )
  }

  cancel() {
    this.worker?.terminate()
    this.worker = null
    this.reject?.(new CancelledError())
    this.reject = null
  }

  private run<T>(req: WorkerRequest, onProgress?: (progress: SolveProgress) => void): Promise<T> {
    this.cancel()
    const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
    this.worker = worker
    return new Promise<T>((resolve, reject) => {
      this.reject = reject
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.kind === 'progress') {
          onProgress?.(e.data.progress)
          return
        }
        this.reject = null
        resolve(e.data.data as T)
      }
      worker.onerror = (e) => {
        this.reject = null
        reject(new Error(e.message))
      }
      worker.postMessage(req)
    })
  }
}
