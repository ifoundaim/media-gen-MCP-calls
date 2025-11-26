FROM node:22-alpine

# Work inside the inner XMCP app directory
WORKDIR /app

# Install dependencies
COPY media-gen-MCP-calls/media-gen-MCP-calls/package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY media-gen-MCP-calls/media-gen-MCP-calls ./

# Build the XMCP project (outputs to dist/)
RUN npm run build

# XMCP HTTP server listens on 3001 by default
EXPOSE 3001

# Start the HTTP transport server
CMD ["npm", "start"]


