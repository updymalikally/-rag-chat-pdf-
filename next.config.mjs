/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse and the Pinecone client must stay as plain Node modules on the server
  serverExternalPackages: [
    "pdf-parse",
    "@pinecone-database/pinecone",
    "@office-open/doc",
    "@office-open/docx",
    "@office-open/ppt",
    "@office-open/pptx",
  ],
};

export default nextConfig;
