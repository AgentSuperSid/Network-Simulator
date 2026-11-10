# React + Vite

## Interactive network lab

Run `npm install` and `npm run dev` to start the lab. Send a TCP or UDP message, pause it, and use **Bits** to change payload bits. Resume or step to the next hop to see the result. Click a dotted link to disconnect or reconnect it; reset restores the initial scenario. The zoom buttons enlarge the topology, while the inspection controls reveal packet and bit details.

This is an educational model, not a full internet or protocol implementation. The topology and route are fixed, CRC-32 is calculated over payload bytes (not a complete Ethernet frame), and TCP gets one simplified retry. Ethernet, IP and transport fields are illustrative rather than serialized wire headers. No real network traffic or malware is generated.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

- I am planning to add more features to make it more interactive to the level of bits.
- It should also be able to interact in a way how hackers do in a network in a simpler form.
- We should be able to see the packet changing as it goess through the different layers. 
- We should be able to change bits in between to see how a network handles errors.
- As you keep zooming, the inside smaller stuff should should start getting visible.
- My vision is for it to look like the 3D code visualizer of Chromium code made by a guy. But here it should be less code. Only bits and some short naming.
- But in my idea it should still be less text except the bits.
- Some folders are not uploaded in GitHub.

Run corruption and UTF-8 boundary tests with: node --test src/integrity.test.js

