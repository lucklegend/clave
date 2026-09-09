/**
 * Types for the slice of `libheif-js` that `./transcode.ts` uses.
 *
 * The package ships no types of its own for this API. It does carry a `libheif/libheif.d.ts`,
 * but that is the auto-generated Emscripten binding surface — a thousand `_heif_context_alloc`
 * style entry points — and it does not describe `HeifDecoder`, which is the hand-written
 * convenience wrapper the README documents and the only thing we call. There is nothing to
 * import and nothing to widen, so the honest options are a declaration or an assertion at every
 * call site. This is the declaration.
 *
 * It is written narrow on purpose: three methods, the two that report the decoded image's size
 * and the one that renders it into an RGBA buffer. Declaring more would be inventing a contract
 * for calls nobody makes, and a declaration is a promise the compiler enforces against us rather
 * than against the library.
 *
 * **Why `wasm-bundle.js` and why the extension.** `libheif-js`'s main entry is a three-megabyte
 * pure-JavaScript build of libheif; `wasm-bundle` is the WebAssembly build with the `.wasm`
 * binary inlined, which is the one that carries the decoders. Its sibling `wasm` entry reads the
 * `.wasm` from a path relative to the *process* working directory, so it only resolves when the
 * process happens to be started inside the package. The `.js` on the specifier is there because
 * the package publishes no `exports` map: Node's ESM resolver will not extend an extensionless
 * subpath, and both Node and the bundler resolve the explicit one.
 *
 * **Why `export default` rather than named exports.** The module is CommonJS and assigns its
 * exports at runtime from Emscripten, so nothing static can see them: under Node's ESM interop
 * `HeifDecoder` is not a named export and reads back `undefined`, while the default export is
 * the whole `module.exports` object and always carries it. Declaring the shape the runtime
 * actually produces is what keeps `./transcode.ts` free of a cast.
 */
declare module "libheif-js/wasm-bundle.js" {
  /** The RGBA surface `display` writes into, and hands back to its callback. */
  export interface HeifImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  }

  /** One top-level image out of a HEIF container. */
  export interface HeifImage {
    get_width(): number;
    get_height(): number;
    /**
     * Renders the image into `target` as RGBA and calls `done` with it, or with a falsy value if
     * the decode failed — which is how a container whose codec is not compiled into this build
     * reports itself, so the callback's argument is the one place that failure surfaces.
     */
    display(target: HeifImageData, done: (result: HeifImageData | null | undefined) => void): void;
  }

  export interface HeifDecoder {
    /** Every top-level image in the container, in file order. Throws on an unreadable file. */
    decode(data: Uint8Array): HeifImage[];
  }

  interface LibHeif {
    HeifDecoder: new () => HeifDecoder;
  }

  const libheif: LibHeif;

  export default libheif;
}
