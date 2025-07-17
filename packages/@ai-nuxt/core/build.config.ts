import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
    'src/providers/index'
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true
  }
})