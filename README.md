---
title: Webapp Factory WizardCoder
emoji: 🏭🧙
colorFrom: brown
colorTo: red
sdk: docker
pinned: false
app_port: 7860
---

A minimalist Docker project to generate apps on demand.

Note: this uses a Hugging Face Inference Endpoint.

Ready to be used in a Hugging Face Space.

# Examples

## Local prompt examples

```
http://localhost:7860/?prompt=A%20simple%20page%20to%20compute%20the%20BMI%20(use%20SI%20units)
```

# Installation
## Building and run without Docker

```bash
nvm use
npm i
HF_API_TOKEN=******* HF_END_POINT_URL=https://*******.endpoints.huggingface.cloud npm run start
```

## Building and running with Docker

```bash
npm run docker
```

This script is a shortcut executing the following commands:

```bash
docker build -t webapp-factory-wizardcoder .
docker run -it -p 7860:7860 webapp-factory-wizardcoder
```