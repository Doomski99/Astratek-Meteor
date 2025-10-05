# ONNX Runtime WASM Assets

The client now loads WebAssembly binaries for `onnxruntime-web` directly from jsDelivr. No local `.wasm`
artifacts are committed to the repository so downstream contributors do not need to stage large binary
assets when opening pull requests. If the CDN location ever changes, update the path configured in
`src/model/neoClassifier.js`.
