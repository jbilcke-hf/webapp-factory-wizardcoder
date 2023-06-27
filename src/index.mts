import express from "express"
import { HfInference } from '@huggingface/inference'

import { daisy } from "./daisy.mts"
import { alpine } from "./alpine.mts"

const hf = new HfInference(process.env.HF_API_TOKEN)

// TODO put here the Inference Endpoint url for WizardCoder
const model = hf.endpoint('https://xyz.eu-west-1.aws.endpoints.huggingface.cloud/gpt2');

// define the CSS and JS dependencies
const css = [
  "/css/daisyui@2.6.0.css",
].map(item => `<link href="${item}" rel="stylesheet" type="text/css"/>`)
.join("")

const script = [
  "/js/alpinejs@3.12.2.js",
  "/js/tailwindcss@3.3.2.js"
].map(item => `<script src="${item}"></script>`)
.join("")

const app = express()
const port = 7860

const minPromptSize = 16 // if you change this, you will need to also change in public/index.html
const timeoutInSec = 3 * 60

console.log("timeout set to 3 minutes")

app.use(express.static("public"))
 
const pending: {
  total: number;
  queue: string[];
} = {
  total: 0,
  queue: [],
}
 
const endRequest = (id: string, reason: string) => {
  if (!id || !pending.queue.includes(id)) {
    return
  }
  
  pending.queue = pending.queue.filter(i => i !== id)
  console.log(`request ${id} ended (${reason})`)
}

app.get("/debug", (req, res) => {
  res.write(JSON.stringify({
    nbTotal: pending.total,
    nbPending: pending.queue.length,
    queue: pending.queue,
  }))
  res.end()
})

app.get("/app", async (req, res) => {

  if (`${req.query.prompt}`.length < minPromptSize) {
    res.write(`prompt too short, please enter at least ${minPromptSize} characters`)
    res.end()
    return
  }

  const id = `${pending.total++}`
  console.log(`new request ${id}`)

  pending.queue.push(id)

  const prefix = `<html><head>${css}${script}`
  res.write(prefix)

  req.on("close", function() {
    // console.log("browser asked to close the stream for some reason.. let's ignore!")
    endRequest(id, "browser asked to end the connection")
  })

  // for testing we kill after some delay
  setTimeout(() => {
    endRequest(id, `timed out after ${timeoutInSec}s`)
  }, timeoutInSec * 1000)


  const finalPrompt = `# Task
Generate the following: ${req.query.prompt}
# Documentation
${daisy}
# Guidelines
- Never repeat the instruction, instead directly write the final code within a script tag
- Use a color scheme consistent with the brief and theme
- You need to use Tailwind CSS and DaisyUI for the UI, pure vanilla JS and AlpineJS for the JS.
- All the JS code will be written directly inside the page, using <script type="text/javascript">...</script>
- You MUST use English, not Latin! (I repeat: do NOT write lorem ipsum!)
- No need to write code comments, and try to make the code compact (short function names etc)
- Use a central layout by wrapping everything in a \`<div class="flex flex-col justify-center">\`
# HTML output
${prefix}`

  try {
    let result = ''
    for await (const output of hf.textGenerationStream({
      inputs: finalPrompt,
      parameters: { max_new_tokens: 1024 }
    })) {
      if (!pending.queue.includes(id)) {
        break
      }
      result += output.token.text
      process.stdout.write(output.token.text)
      res.write(output.token.text)
      if (result.includes('</html>')) {
        break
      }
    }

    endRequest(id, `normal end of the LLM stream for request ${id}`)
  } catch (e) {
    endRequest(id, `premature end of the LLM stream for request ${id} (${e})`)
  } 

  try {
    res.end()
  } catch (err) {
    console.log(`couldn't end the HTTP stream for request ${id} (${err})`)
  }
  
})

app.listen(port, () => { console.log(`Open http://localhost:${port}/?prompt=a%20pong%20game%20clone%20in%20HTML,%20made%20using%20the%20canvas`) })

