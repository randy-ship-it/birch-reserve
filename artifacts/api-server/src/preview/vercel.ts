// @ts-expect-error bundled as text by esbuild (--loader:.html=text)
import indexHtml from "../../../clinichub-media/dist/public/index.html";
import { createPreviewApp } from "./app";
const app = createPreviewApp(indexHtml as unknown as string);
export default app;
