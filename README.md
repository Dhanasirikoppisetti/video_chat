# VideoChat Atlas – Real-Time Video Calling Application

VideoChat Atlas is a real-time video communication application built using WebRTC and Socket.IO. The project allows multiple users to create or join rooms and communicate using live video and audio streams.

The application is designed to support peer-to-peer communication while maintaining low latency and real-time interaction between users across different networks.

## Features

* Real-time video and audio communication
* Room creation with unique room IDs
* Multi-user room support
* WebRTC peer-to-peer communication
* Socket.IO signaling server
* STUN and TURN server integration for better network compatibility
* Dynamic room routing using Next.js App Router
* Docker support for containerized deployment
* Responsive interface for different screen sizes
* Camera and microphone access handling

## Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend / Communication

* Socket.IO
* WebRTC
* Node.js
* Express Server

### Deployment / Infrastructure

* Docker
* Docker Compose
* Render Deployment
* Metered TURN Servers

## Project Structure

```text
videochat/
│
├── app/
│   ├── page.tsx
│   └── room/
│       └── [roomId]/
│           └── page.tsx
│
├── server.ts
├── docker-compose.yml
├── Dockerfile
├── package.json
└── README.md
```

## Installation

Clone the repository:

```bash
git clone https://github.com/Dhanasirikoppisetti/video_chat
cd videochat
```

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Running with Docker

Build and run:

```bash
docker compose up --build
```

Access application:

```text
http://localhost:3000
```

## Deployment

The project can be deployed using Render.

Steps:

1. Push code to GitHub
2. Connect repository to Render
3. Configure build command:

```text
npm install && npm run build
```

4. Configure start command:

```text
npm start
```

5. Deploy application

## WebRTC Connectivity

This project uses:

* STUN server for public IP discovery
* TURN server for network traversal across different ISPs and NAT configurations

TURN integration improves connectivity between users on different networks.

## Challenges Faced

Some common challenges during development included:

* NAT traversal issues
* WebRTC peer connection failures
* Cross-network communication problems
* Deployment configuration
* Socket signaling synchronization

These were resolved using TURN servers and improved signaling logic.

## Future Improvements

* Text chat support
* Screen sharing
* Call recording
* User authentication
* Better room management
* Improved UI/UX
* Connection quality indicators

## Author

Developed as part of a real-time communication project using modern web technologies.
