import express from "express";
import "dotenv/config";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import indexRoutes from "./routes/index.routes.js";
import chatRoutes from "./routes/chat.routes.js";

const app = express();
app.use(express.json());

app.use("/api/inngest", serve({ client: inngest, functions }));


app.get("/health", (req, res) => {
  res.send("Server is healthy");
});

app.use("/api/index", indexRoutes);
app.use("/api/chat", chatRoutes);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});