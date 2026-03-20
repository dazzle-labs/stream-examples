# Hello World

Broadcast-quality visual showcase -- five cinematic scenes with smooth transitions. Proof that "hello world" doesn't have to look like one.

![Preview](preview.png)

## Run It

```bash
npm install
npm run dev
```

## Deploy It

```bash
npm run build
dazzle stage create hello-world
dazzle stage up --stage hello-world
dazzle stage sync ./dist --stage hello-world --watch
```

## What You'll See

Five scenes cycling with smooth fades through black: a particle constellation, a terminal typing out the dazzle workflow, an animated pipeline diagram, kinetic typography, and a waveform visualization.
