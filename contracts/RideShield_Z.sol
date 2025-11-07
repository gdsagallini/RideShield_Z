pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract RideShieldZ is ZamaEthereumConfig {
    struct EncryptedLocation {
        euint32 encryptedLatitude;
        euint32 encryptedLongitude;
        uint256 publicTimestamp;
        address rider;
        bool isMatched;
    }

    struct Driver {
        address driverAddress;
        euint32 encryptedCurrentLatitude;
        euint32 encryptedCurrentLongitude;
        uint256 lastUpdate;
        bool isActive;
    }

    struct RideRequest {
        string rideId;
        EncryptedLocation pickup;
        EncryptedLocation destination;
        uint256 requestTime;
        bool isAssigned;
    }

    mapping(string => RideRequest) public rideRequests;
    mapping(address => Driver) public drivers;
    string[] public activeRideIds;

    event RideRequested(string indexed rideId, address indexed rider);
    event DriverRegistered(address indexed driver);
    event LocationUpdated(address indexed driver);
    event RideMatched(string indexed rideId, address indexed driver);

    constructor() ZamaEthereumConfig() {}

    function requestRide(
        string calldata rideId,
        externalEuint32 encryptedPickupLat,
        bytes calldata pickupLatProof,
        externalEuint32 encryptedPickupLon,
        bytes calldata pickupLonProof,
        externalEuint32 encryptedDestLat,
        bytes calldata destLatProof,
        externalEuint32 encryptedDestLon,
        bytes calldata destLonProof
    ) external {
        require(rideRequests[rideId].requestTime == 0, "Ride ID already exists");

        euint32 pickupLat = FHE.fromExternal(encryptedPickupLat, pickupLatProof);
        euint32 pickupLon = FHE.fromExternal(encryptedPickupLon, pickupLonProof);
        euint32 destLat = FHE.fromExternal(encryptedDestLat, destLatProof);
        euint32 destLon = FHE.fromExternal(encryptedDestLon, destLonProof);

        require(FHE.isInitialized(pickupLat), "Invalid pickup latitude");
        require(FHE.isInitialized(pickupLon), "Invalid pickup longitude");
        require(FHE.isInitialized(destLat), "Invalid destination latitude");
        require(FHE.isInitialized(destLon), "Invalid destination longitude");

        FHE.allowThis(pickupLat);
        FHE.allowThis(pickupLon);
        FHE.allowThis(destLat);
        FHE.allowThis(destLon);

        rideRequests[rideId] = RideRequest({
            rideId: rideId,
            pickup: EncryptedLocation({
                encryptedLatitude: pickupLat,
                encryptedLongitude: pickupLon,
                publicTimestamp: block.timestamp,
                rider: msg.sender,
                isMatched: false
            }),
            destination: EncryptedLocation({
                encryptedLatitude: destLat,
                encryptedLongitude: destLon,
                publicTimestamp: block.timestamp,
                rider: msg.sender,
                isMatched: false
            }),
            requestTime: block.timestamp,
            isAssigned: false
        });

        activeRideIds.push(rideId);
        emit RideRequested(rideId, msg.sender);
    }

    function registerDriver(
        externalEuint32 encryptedCurrentLat,
        bytes calldata latProof,
        externalEuint32 encryptedCurrentLon,
        bytes calldata lonProof
    ) external {
        require(!drivers[msg.sender].isActive, "Driver already registered");

        euint32 currentLat = FHE.fromExternal(encryptedCurrentLat, latProof);
        euint32 currentLon = FHE.fromExternal(encryptedCurrentLon, lonProof);

        require(FHE.isInitialized(currentLat), "Invalid latitude");
        require(FHE.isInitialized(currentLon), "Invalid longitude");

        FHE.allowThis(currentLat);
        FHE.allowThis(currentLon);

        drivers[msg.sender] = Driver({
            driverAddress: msg.sender,
            encryptedCurrentLatitude: currentLat,
            encryptedCurrentLongitude: currentLon,
            lastUpdate: block.timestamp,
            isActive: true
        });

        emit DriverRegistered(msg.sender);
    }

    function updateDriverLocation(
        externalEuint32 encryptedNewLat,
        bytes calldata latProof,
        externalEuint32 encryptedNewLon,
        bytes calldata lonProof
    ) external {
        require(drivers[msg.sender].isActive, "Driver not registered");

        euint32 newLat = FHE.fromExternal(encryptedNewLat, latProof);
        euint32 newLon = FHE.fromExternal(encryptedNewLon, lonProof);

        require(FHE.isInitialized(newLat), "Invalid latitude");
        require(FHE.isInitialized(newLon), "Invalid longitude");

        FHE.allowThis(newLat);
        FHE.allowThis(newLon);

        drivers[msg.sender].encryptedCurrentLatitude = newLat;
        drivers[msg.sender].encryptedCurrentLongitude = newLon;
        drivers[msg.sender].lastUpdate = block.timestamp;

        emit LocationUpdated(msg.sender);
    }

    function findMatch(
        string calldata rideId,
        euint32 encryptedDriverLat,
        euint32 encryptedDriverLon
    ) external {
        require(rideRequests[rideId].requestTime > 0, "Ride request does not exist");
        require(!rideRequests[rideId].isAssigned, "Ride already assigned");
        require(drivers[msg.sender].isActive, "Driver not registered");

        euint32 pickupLat = rideRequests[rideId].pickup.encryptedLatitude;
        euint32 pickupLon = rideRequests[rideId].pickup.encryptedLongitude;

        euint32 distance = FHE.euclideanDistance(
            encryptedDriverLat,
            encryptedDriverLon,
            pickupLat,
            pickupLon
        );

        require(FHE.leq(distance, 100), "Driver too far from pickup location");

        rideRequests[rideId].isAssigned = true;
        rideRequests[rideId].pickup.isMatched = true;
        rideRequests[rideId].destination.isMatched = true;

        emit RideMatched(rideId, msg.sender);
    }

    function getRideRequest(string calldata rideId) external view returns (
        address rider,
        uint256 requestTime,
        bool isAssigned
    ) {
        require(rideRequests[rideId].requestTime > 0, "Ride request does not exist");
        return (
            rideRequests[rideId].pickup.rider,
            rideRequests[rideId].requestTime,
            rideRequests[rideId].isAssigned
        );
    }

    function getDriverInfo(address driverAddress) external view returns (
        uint256 lastUpdate,
        bool isActive
    ) {
        require(drivers[driverAddress].isActive, "Driver not registered");
        return (drivers[driverAddress].lastUpdate, drivers[driverAddress].isActive);
    }

    function getActiveRideIds() external view returns (string[] memory) {
        return activeRideIds;
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}


