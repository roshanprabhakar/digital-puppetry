# Digital Puppetry - Audience
This project intends to provide a tool to extract and measure audience feedback

### Usage

clone the repository:
```sh
git clone https://github.com/roshanprabhakar/digital-puppetry
```

Run the signalling server:
```sh
node app.js
```

Connect to this server:
```sh
parcel sender/sender.html --no-hmr --open
```
* The first connection is designated the receiver (director) node, all data is streamed to this node
* All following connections stream facemesh information to the receiver node

### Note
* facemesh information is streamed
* posenet is not used for data extraction

### TODO
* facemesh extraction is extremely slow, look through the sender and receiver script for software latencies
* facemesh is not accurately scaled, even though the extraction dimensions and projection dimensions are the same
