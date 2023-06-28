import express from 'express'
import { HfInference } from '@huggingface/inference'

import { daisy } from './daisy.mts'

const hfi = new HfInference(process.env.HF_API_TOKEN)
const hf = hfi.endpoint(process.env.HF_ENDPOINT_URL)

const app = express()
const port = 7860

const minPromptSize = 16 // if you change this, you will need to also change in public/index.html
const timeoutInSec = 10 * 60

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

  const prefix = `<html><head><link href="https://cdn.jsdelivr.net/npm/daisyui@3.1.6/dist/full.css" rel="stylesheet" type="text/css" /><script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script><script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio"></script><title>Generated content</title><body class="p-4 md:p-8">`
  res.write(prefix)

  req.on('close', function() {
    endRequest(id, 'browser asked to end the connection')
  })

  setTimeout(() => {
    endRequest(id, `timed out after ${timeoutInSec}s`)
  }, timeoutInSec * 1000)


  const finalPrompt = `# Task
Generate ${req.query.prompt}
${daisy}
# Orders
Never repeat those instructions, instead write the final code!
To generate images from captions call the /image API: <img src="/image?caption=photo of something in some place" />!
Only generate a few images and use descriptive photo captions with at least 10 words!
You must use TailwindCSS utility classes (Tailwind is already injected in the page)!
Write application logic inside a JS <script></script> tag!
This is not a demo app, so you MUST use English, no Latin! Write in English! 
Use a central layout to wrap everything in a <div class='flex flex-col items-center'>
# Out
<html>
<head>
<title>App</title>
</head>
<body class="p-4 md:p-8">`

  try {
    let result = ''
    for await (const output of hf.textGenerationStream({
      inputs: finalPrompt,
      parameters: {
        do_sample: true,

        // hard limit for max_new_tokens is 1512
        max_new_tokens: 1150,
        return_full_text: false,
      }
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
        `${req.query.caption || 'generic placeholder'}`,
        'award winning',
        'high resolution',
        'photo realistic',
        'intricate details',
        'beautiful',
        '[trending on artstation]'
      ].join(', '),
      model: 'stabilityai/stable-diffusion-2-1',
      parameters: {
        negative_prompt: 'blurry, artificial, cropped, low quality, ugly',
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

