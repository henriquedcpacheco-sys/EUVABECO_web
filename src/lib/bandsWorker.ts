// Runs the 500-draw predictive band off the main thread.
import { predictiveBands, type AgeDraws } from './simulator'

self.onmessage = (e: MessageEvent<AgeDraws>) => {
  const bands = predictiveBands(e.data)
  self.postMessage(bands)
}
