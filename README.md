# Private Ride Hailing Protocol - RideShield

RideShield is a privacy-preserving ride-hailing protocol that harnesses Zama's Fully Homomorphic Encryption (FHE) technology. With RideShield, passenger locations and destinations are encrypted, enabling secure matching of orders without compromising user privacy. This innovative project ensures that the platform cannot track user movements, redefining privacy standards in the ride-hailing industry.

## The Problem

In most ride-hailing services, passenger data is vulnerable to various privacy threats. When users share their locations and destinations in cleartext, they expose sensitive information to potential surveillance and tracking by third parties or the platforms themselves. This lack of privacy not only deters users from utilizing ride-hailing services but also raises concerns about data misuse. The challenge lies in providing secure transportation solutions that prioritize user confidentiality while maintaining operational efficiency.

## The Zama FHE Solution

Zama's FHE technology addresses these privacy concerns head-on. By enabling **computation on encrypted data**, RideShield allows the ride-hailing platform to match drivers with passengers while keeping sensitive information hidden. Leveraging **fhevm**, the system can process encrypted inputs such as location coordinates and distance calculations without exposing the underlying data. This innovative approach ensures that user privacy is upheld throughout the entire ride-hailing process.

## Key Features

- 🔒 **Data Privacy**: All passenger and driver information is encrypted, ensuring that sensitive data remains confidential.
- 🚖 **Secure Order Matching**: Drivers receive encrypted order details, enabling them to match with passengers without accessing their cleartext location.
- 🛡️ **Anonymous Tracking**: No tracking of user movements is conducted, preserving the anonymity of passengers throughout their journey.
- 🎯 **Distance Matching**: Enables accurate ride matching based on encrypted distance calculations, ensuring efficient operations without sacrificing privacy.
- 🗺️ **User-Friendly Interface**: The application provides an intuitive interface for both drivers and passengers, enhancing user experience while prioritizing security.

## Technical Architecture & Stack

The architecture of RideShield is designed to ensure seamless integration of Zama's privacy technology into the ride-hailing ecosystem. The stack includes:

- **Frontend**: React for user interface
- **Backend**: Node.js for server-side logic
- **Blockchain Layer**: Using **fhevm** for processing encrypted transactions
- **Core Privacy Engine**: Zama's FHE libraries, particularly **Concrete for machine learning tasks** and **fhevm** for encrypted computations.

## Smart Contract / Core Logic

Below is a simplified code snippet demonstrating how Zama's FHE technology can be utilized within the RideShield protocol for encrypting and processing order data:

```solidity
pragma solidity ^0.8.0;

import "Zama/fhevm.sol";

contract RideShield {
    struct Ride {
        uint64 passengerLocation; // Encrypted location of the passenger
        uint64 driverLocation; // Encrypted location of the driver
    }

    // Function to match driver and passenger
    function matchRide(Ride memory ride) public {
        // Encrypted distance calculation
        uint64 distance = TFHE.add(ride.passengerLocation, ride.driverLocation);
        // Logic to accept or reject the ride based on distance
    }
}
```

## Directory Structure

The directory structure of the RideShield project is organized as follows:

```
RideShield/
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   └── index.js
│   └── public/
├── backend/
│   ├── server.js
│   └── contracts/
│       └── RideShield.sol
└── README.md
```

## Installation & Setup

### Prerequisites

Before running RideShield, ensure you have the following installed:

- Node.js
- npm or yarn (for dependency management)
- A Solidity-compatible Ethereum network or test environment (like Ganache or Hardhat)

### Installing Dependencies

To get started, navigate to the backend directory and install the necessary packages:

```bash
cd backend
npm install fhevm
npm install express
```

For the frontend dependencies, navigate to the frontend directory:

```bash
cd frontend
npm install react react-dom
```

## Build & Run

To build and run the RideShield application, follow these steps:

1. **Compile the Smart Contract** (in the backend directory):
   ```bash
   npx hardhat compile
   ```

2. **Run the Backend Server**:
   ```bash
   node server.js
   ```

3. **Start the Frontend Application** (in the frontend directory):
   ```bash
   npm start
   ```

This will launch the application, allowing you to start utilizing the privacy-preserving features of RideShield.

## Acknowledgements

Special thanks to Zama for providing the open-source FHE primitives that make this project possible. Their innovative technology empowers developers to build privacy-first applications, reshaping data security standards across various industries.


