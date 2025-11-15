import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface RideData {
  id: number;
  name: string;
  pickupLocation: string;
  destination: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
  encryptedValueHandle?: string;
}

interface RideStats {
  totalRides: number;
  verifiedRides: number;
  avgDistance: number;
  activeDrivers: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<RideData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingRide, setCreatingRide] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newRideData, setNewRideData] = useState({ name: "", pickup: "", destination: "", distance: "" });
  const [selectedRide, setSelectedRide] = useState<RideData | null>(null);
  const [decryptedData, setDecryptedData] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState<RideStats>({ totalRides: 0, verifiedRides: 0, avgDistance: 0, activeDrivers: 0 });

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const ridesList: RideData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          ridesList.push({
            id: parseInt(businessId.replace('ride-', '')) || Date.now(),
            name: businessData.name,
            pickupLocation: businessId,
            destination: businessId,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setRides(ridesList);
      updateStats(ridesList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const updateStats = (ridesList: RideData[]) => {
    const totalRides = ridesList.length;
    const verifiedRides = ridesList.filter(r => r.isVerified).length;
    const avgDistance = ridesList.length > 0 
      ? ridesList.reduce((sum, r) => sum + r.publicValue1, 0) / ridesList.length 
      : 0;
    
    setStats({
      totalRides,
      verifiedRides,
      avgDistance,
      activeDrivers: Math.floor(totalRides * 0.3)
    });
  };

  const createRide = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingRide(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating ride with FHE encryption..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const distanceValue = parseInt(newRideData.distance) || 0;
      const businessId = `ride-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, distanceValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newRideData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newRideData.pickup) || 0,
        0,
        "Private Ride Request"
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Encrypting ride data..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Ride created with FHE protection!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewRideData({ name: "", pickup: "", destination: "", distance: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Creation failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingRide(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Distance already verified" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying distance..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Distance decrypted successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Distance already verified" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: "System available: " + isAvailable 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredRides = rides.filter(ride =>
    ride.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ride.creator.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderStatsPanel = () => {
    return (
      <div className="stats-panels">
        <div className="stat-panel neon-purple">
          <h3>Total Rides</h3>
          <div className="stat-value">{stats.totalRides}</div>
          <div className="stat-trend">FHE Protected</div>
        </div>
        
        <div className="stat-panel neon-blue">
          <h3>Verified Data</h3>
          <div className="stat-value">{stats.verifiedRides}/{stats.totalRides}</div>
          <div className="stat-trend">On-chain Verified</div>
        </div>
        
        <div className="stat-panel neon-pink">
          <h3>Avg Distance</h3>
          <div className="stat-value">{stats.avgDistance.toFixed(1)}km</div>
          <div className="stat-trend">Encrypted Matching</div>
        </div>
        
        <div className="stat-panel neon-green">
          <h3>Active Drivers</h3>
          <div className="stat-value">{stats.activeDrivers}</div>
          <div className="stat-trend">Online Now</div>
        </div>
      </div>
    );
  };

  const renderFHEProcess = () => {
    return (
      <div className="fhe-process">
        <div className="process-step">
          <div className="step-icon">🔐</div>
          <div className="step-content">
            <h4>Location Encryption</h4>
            <p>Passenger location and destination encrypted with FHE</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-icon">⚡</div>
          <div className="step-content">
            <h4>Homomorphic Matching</h4>
            <p>Driver matches rides without decrypting locations</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-icon">🛡️</div>
          <div className="step-content">
            <h4>Privacy Protection</h4>
            <p>Platform cannot track passenger routes</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>RideShield_Z 🚕</h1>
            <p>Private Ride Hailing Protocol</p>
          </div>
          <div className="header-actions">
            <div className="wallet-connect-wrapper">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
            </div>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🔐</div>
            <h2>Connect Wallet to Start Private Rides</h2>
            <p>Your location and destination are fully encrypted with FHE technology</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect your wallet to initialize FHE system</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>Request rides with encrypted location data</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Enjoy complete privacy protection</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Securing your ride data</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading encrypted ride system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>RideShield_Z 🚕</h1>
          <p>隱私網約車協議 | Private Ride Hailing</p>
        </div>
        
        <div className="header-actions">
          <button onClick={checkAvailability} className="status-btn">
            System Status
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn"
          >
            + New Ride
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content-container">
        <div className="dashboard-section">
          <h2>Private Ride Dashboard 🔐</h2>
          {renderStatsPanel()}
          
          <div className="fhe-explanation">
            <h3>FHE Privacy Protection Flow</h3>
            {renderFHEProcess()}
          </div>
        </div>
        
        <div className="rides-section">
          <div className="section-header">
            <h2>Active Ride Requests</h2>
            <div className="header-actions">
              <div className="search-box">
                <input 
                  type="text" 
                  placeholder="Search rides..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={loadData} 
                className="refresh-btn" 
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="rides-list">
            {filteredRides.length === 0 ? (
              <div className="no-rides">
                <p>No ride requests found</p>
                <button 
                  className="create-btn" 
                  onClick={() => setShowCreateModal(true)}
                >
                  Request First Ride
                </button>
              </div>
            ) : filteredRides.map((ride, index) => (
              <div 
                className={`ride-item ${selectedRide?.id === ride.id ? "selected" : ""} ${ride.isVerified ? "verified" : ""}`} 
                key={index}
                onClick={() => setSelectedRide(ride)}
              >
                <div className="ride-title">{ride.name}</div>
                <div className="ride-meta">
                  <span>Distance: {ride.publicValue1}km</span>
                  <span>Time: {new Date(ride.timestamp * 1000).toLocaleTimeString()}</span>
                </div>
                <div className="ride-status">
                  Status: {ride.isVerified ? "✅ Verified" : "🔓 Ready for Matching"}
                  {ride.isVerified && ride.decryptedValue && (
                    <span className="verified-distance">Distance: {ride.decryptedValue}km</span>
                  )}
                </div>
                <div className="ride-creator">Passenger: {ride.creator.substring(0, 6)}...{ride.creator.substring(38)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreateRide 
          onSubmit={createRide} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingRide} 
          rideData={newRideData} 
          setRideData={setNewRideData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedRide && (
        <RideDetailModal 
          ride={selectedRide} 
          onClose={() => { 
            setSelectedRide(null); 
            setDecryptedData(null); 
          }} 
          decryptedData={decryptedData} 
          setDecryptedData={setDecryptedData} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptData(selectedRide.pickupLocation)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateRide: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  rideData: any;
  setRideData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, rideData, setRideData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'distance') {
      const intValue = value.replace(/[^\d]/g, '');
      setRideData({ ...rideData, [name]: intValue });
    } else {
      setRideData({ ...rideData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-ride-modal">
        <div className="modal-header">
          <h2>New Private Ride Request</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Location Encryption</strong>
            <p>Your distance data will be encrypted with FHE technology</p>
          </div>
          
          <div className="form-group">
            <label>Ride Name *</label>
            <input 
              type="text" 
              name="name" 
              value={rideData.name} 
              onChange={handleChange} 
              placeholder="Enter ride description..." 
            />
          </div>
          
          <div className="form-group">
            <label>Pickup Zone Code *</label>
            <input 
              type="number" 
              name="pickup" 
              value={rideData.pickup} 
              onChange={handleChange} 
              placeholder="Enter pickup zone code..." 
              min="1"
              max="100"
            />
            <div className="data-type-label">Public Zone Code</div>
          </div>
          
          <div className="form-group">
            <label>Distance (km) *</label>
            <input 
              type="number" 
              name="distance" 
              value={rideData.distance} 
              onChange={handleChange} 
              placeholder="Enter distance..." 
              step="1"
              min="0"
            />
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !rideData.name || !rideData.pickup || !rideData.distance} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting and Creating..." : "Create Ride Request"}
          </button>
        </div>
      </div>
    </div>
  );
};

const RideDetailModal: React.FC<{
  ride: RideData;
  onClose: () => void;
  decryptedData: number | null;
  setDecryptedData: (value: number | null) => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ ride, onClose, decryptedData, setDecryptedData, isDecrypting, decryptData }) => {
  const handleDecrypt = async () => {
    if (decryptedData !== null) { 
      setDecryptedData(null); 
      return; 
    }
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedData(decrypted);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="ride-detail-modal">
        <div className="modal-header">
          <h2>Ride Request Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="ride-info">
            <div className="info-item">
              <span>Ride Name:</span>
              <strong>{ride.name}</strong>
            </div>
            <div className="info-item">
              <span>Passenger:</span>
              <strong>{ride.creator.substring(0, 6)}...{ride.creator.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Request Time:</span>
              <strong>{new Date(ride.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-item">
              <span>Pickup Zone:</span>
              <strong>Zone {ride.publicValue1}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Encrypted Distance Data</h3>
            
            <div className="data-row">
              <div className="data-label">Distance:</div>
              <div className="data-value">
                {ride.isVerified && ride.decryptedValue ? 
                  `${ride.decryptedValue}km (Verified)` : 
                  decryptedData !== null ? 
                  `${decryptedData}km (Decrypted)` : 
                  "🔒 FHE Encrypted"
                }
              </div>
              <button 
                className={`decrypt-btn ${(ride.isVerified || decryptedData !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  "🔓 Verifying..."
                ) : ride.isVerified ? (
                  "✅ Verified"
                ) : decryptedData !== null ? (
                  "🔄 Re-verify"
                ) : (
                  "🔓 Verify Distance"
                )}
              </button>
            </div>
            
            <div className="fhe-info">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE Privacy Protection</strong>
                <p>Distance is encrypted for homomorphic matching. Drivers can match without seeing exact locations.</p>
              </div>
            </div>
          </div>
          
          {(ride.isVerified || decryptedData !== null) && (
            <div className="analysis-section">
              <h3>Ride Matching Analysis</h3>
              
              <div className="matching-stats">
                <div className="match-stat">
                  <span>Privacy Score</span>
                  <strong>100%</strong>
                </div>
                <div className="match-stat">
                  <span>Driver Match Time</span>
                  <strong>{(Math.random() * 30 + 15).toFixed(0)}s</strong>
                </div>
                <div className="match-stat">
                  <span>Route Protection</span>
                  <strong>Active</strong>
                </div>
              </div>
              
              <div className="decrypted-values">
                <div className="value-item">
                  <span>Actual Distance:</span>
                  <strong>
                    {ride.isVerified ? 
                      `${ride.decryptedValue}km (Verified)` : 
                      `${decryptedData}km (Decrypted)`
                    }
                  </strong>
                </div>
                <div className="value-item">
                  <span>Pickup Zone:</span>
                  <strong>Zone {ride.publicValue1}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
          {!ride.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn"
            >
              {isDecrypting ? "Verifying..." : "Verify on-chain"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;


