import { pipeline } from 'stream'
import { promisify } from 'util'

import express from 'express'
import { HfInference } from '@huggingface/inference'

import { daisy } from './daisy.mts'

const pipe = promisify(pipeline)

const hfi = new HfInference(process.env.HF_API_TOKEN)
const hf = hfi.endpoint(process.env.HF_ENDPOINT_URL)

const app = express()
const port = 7860

const minPromptSize = 16 // if you change this, you will need to also change in public/index.html
const timeoutInSec = 30 * 60

console.log('timeout set to 30 minutes')

app.use(express.static('public'))

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

app.get('/debug', (req, res) => {
  res.write(JSON.stringify({
    nbTotal: pending.total,
    nbPending: pending.queue.length,
    queue: pending.queue,
  }))
  res.end()
})

app.get('/app', async (req, res) => {
  if (`${req.query.prompt}`.length < minPromptSize) {
    res.write(`prompt too short, please enter at least ${minPromptSize} characters`)
    res.end()
    return
  }

  const id = `${pending.total++}`
  console.log(`new request ${id}`)

  pending.queue.push(id)

  const prefix = `<html><head><link href='https://cdn.jsdelivr.net/npm/daisyui@3.1.6/dist/full.css' rel='stylesheet' type='text/css' /><script defer src='https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js'></script><script src='https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,line-clamp'></script><title>Generated content</title><body`
  res.write(prefix)

  req.on('close', function() {
    endRequest(id, 'browser asked to end the connection')
  })

  setTimeout(() => {
    endRequest(id, `timed out after ${timeoutInSec}s`)
  }, timeoutInSec * 1000)


  const finalPrompt = `# Task
Generate the following: ${req.query.prompt}
# API Documentation
${daisy}
# Guidelines
- Never repeat the instruction, instead directly write the final code
- Use a color scheme consistent with the brief and theme
- To generate all your images, import from from this route: "/image?prompt=<description or caption of an image, photo or illustration>"
- please be descriptive for the prompt, eg describe the scene in a few words (textures, characters, materials, camera type etc)
- You must use Tailwind CSS and Daisy UI for the CSS classes, vanilla JS and Alpine.js for the JS.
- All the JS code will be written directly inside the page, using <script type='text/javascript'>...</script>
- You MUST use English, not Latin! (I repeat: do NOT write lorem ipsum!)
- No need to write code comments, so please make the code compact (short function names etc)
- Use a central layout by wrapping everything in a \`<div class='flex flex-col items-center'>\`
# HTML output
<html><head></head><body`

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
      if (result.includes('<|end|>') || result.includes('<|assistant|>')) {
        break
      }
    }

    endRequest(id, `normal end of the LLM stream for request ${id}`)
  } catch (e) {
    console.log(e)
    endRequest(id, `premature end of the LLM stream for request ${id} (${e})`)
  } 

  try {
    res.end()
  } catch (err) {
    console.log(`couldn't end the HTTP stream for request ${id} (${err})`)
  }
  
})

app.get('/image', async (req, res) => {
  try {
    const blob = await hfi.textToImage({
      inputs: [
        `${req.query.prompt || 'generic placeholder'}`,
        'award winning',
        'high resolution',
        'beautiful',
        '[trending on artstation]'
      ].join(','),
      model: 'stabilityai/stable-diffusion-2',
      parameters: {
        negative_prompt: 'blurry, cropped, low quality, ugly',
      }
    })
    const buffer = Buffer.from(await blob.arrayBuffer())
    res.setHeader('Content-Type', blob.type)
    res.setHeader('Content-Length', buffer.length)
    res.end(buffer)
  } catch (err) {
    console.error(`Error when generating the image: ${err.message}`);
    res.status(500).json({ error: 'An error occurred when trying to generate the image' });
  }
})

app.listen(port, () => { console.log(`Open http://localhost:${port}`) })

