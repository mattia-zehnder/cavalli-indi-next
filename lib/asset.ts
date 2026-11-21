/** Path of a file in /public, prefixed with the base path when hosted in a sub-folder (GitHub Pages). */
export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
