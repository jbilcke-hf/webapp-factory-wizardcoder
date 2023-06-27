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
http://localhost:7860/?prompt=a%20pong%20game%20clone%20in%20HTML,%20made%20using%20the%20canvas
```
```
http://localhost:7860/?prompt=a simple html canvas game where we need to feed tadpoles controlled by an AI. The tadpoles move randomly, but when the user click inside the canvas to add some kind of food, the tadpoles will compete to eat it. Tadpole who didn't eat will die, and those who ate will reproduce.
```

# Installation
## Building and run without Docker

```bash
nvm use
npm i
npm run start
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