export type GridDimensions = {
  readonly width: number
  readonly height: number
}

export type ScalarFieldData = Float32Array

export type VectorFieldData = {
  readonly u: Float32Array
  readonly v: Float32Array
}

export type BoundaryType = 'no-slip' | 'free-slip' | 'periodic' | 'inflow' | 'outflow'

export type SimulationParams = {
  gridWidth: number
  gridHeight: number
  dt: number
  viscosity: number
  density: number
  jacobiIterations: number
}
