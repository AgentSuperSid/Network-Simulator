# React + Vite

## Interactive network lab

Run `npm install` and `npm run dev`. Choose TCP or UDP and click **Start paused**, then **Step event** to follow encapsulation, forwarding, and decapsulation. The structure inspector below the map reveals each field and its bits. While paused in the **wire** stage, click a field and flip its bits. The receiver checks the transmitted FCS and drops corrupted frames; the simplified TCP model makes one retry. Reset restores defaults. Links remain editable during a run.

Serialized formats: Ethernet II (including padding and FCS), IPv4 with a 20-byte header, UDP with an 8-byte header, and TCP with a 20-byte header. IPv4 and transport checksums are calculated; transport checksums include the IP pseudo-header. The pseudo-header is checksum input, not transmitted as an additional header. FCS bytes are shown least-significant byte first, while IP/transport multibyte fields use network byte order. Displayed bit order is MSB-first within each byte, not a physical Ethernet signalling trace.

Switch forwarding preserves the frame. Routers remove link framing, decrement TTL, recalculate the IPv4 checksum, and add new link addresses/FCS while preserving transport bytes. The destination removes link, IP, and transport headers in separate visible steps. The complete frame is retained for inspection even when some layers are not present in the current stage.

Scope: fixed topology, route, addresses and demonstration port 9000. TCP assumes an established connection; its timeout/retry is condensed into one event. No handshake, ARP, DNS, TLS, fragmentation, ICMP error response, malware, or physical signalling is modeled. These are plain demonstration application bytes, not an HTTP or DNS request. No real network traffic is sent. Checksums do not authenticate data.

Format references: [IPv4 RFC 791](https://www.rfc-editor.org/rfc/rfc791), [UDP RFC 768](https://www.rfc-editor.org/rfc/rfc768), [TCP RFC 9293](https://www.rfc-editor.org/rfc/rfc9293).

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

Run corruption and UTF-8 boundary tests with: node --test src/integrity.test.js src/packets.test.js


