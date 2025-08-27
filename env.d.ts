/// <reference types="vite/client" />

// Declare module for .vue files to enable TypeScript support for javascript imports
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
