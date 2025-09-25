import { useState, useEffect } from "react";
import API_BASE_URL from '../utils/apiConfig';

export default function Settings() {
  // 2FA State
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFAStatus, setTwoFAStatus] = useState("");
  // IP Whitelist State
  const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(false);
  const [ipList, setIpList] = useState<string[]>([]);
  const [newIp, setNewIp] = useState("");
  const [ipStatus, setIpStatus] = useState("");

  useEffect(() => {
    // Fetch 2FA and IP whitelist status from backend
  fetch(`${API_BASE_URL}/v1/profile/me`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("authToken")}` }
    })
      .then(res => res.json())
      .then(data => {
        setTwoFAEnabled(data.securitySettings?.twoFactorAuth?.enabled || false);
        setIpWhitelistEnabled(data.securitySettings?.ipWhitelist?.enabled || false);
        setIpList(data.securitySettings?.ipWhitelist?.ips || []);
      });
  }, []);

  // 2FA Handlers
  const handleEnable2FA = async () => {
    setTwoFAStatus("");
  const res = await fetch(`${API_BASE_URL}/v1/2fa/setup`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${localStorage.getItem("authToken")}` },
    });
    const data = await res.json();
    if (data.qrCode) {
      setQrCode(data.qrCode);
    } else {
      setTwoFAStatus("Failed to get QR code.");
    }
  };

  const handleVerify2FA = async () => {
    setTwoFAStatus("");
  const res = await fetch(`${API_BASE_URL}/v1/2fa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("authToken")}` },
      body: JSON.stringify({ code: twoFACode }),
    });
    const data = await res.json();
    if (data.success) {
      setTwoFAEnabled(true);
      setTwoFAStatus("Two-Factor Authentication enabled!");
    } else {
      setTwoFAStatus(data.error || "Verification failed.");
    }
  };

  const handleDisable2FA = async () => {
    setTwoFAStatus("");
  const res = await fetch(`${API_BASE_URL}/v1/2fa/disable`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${localStorage.getItem("authToken")}` },
    });
    const data = await res.json();
    if (data.success) {
      setTwoFAEnabled(false);
      setQrCode("");
      setTwoFAStatus("Two-Factor Authentication disabled.");
    } else {
      setTwoFAStatus(data.error || "Failed to disable.");
    }
  };

  // IP Whitelist Handlers
  const handleEnableIpWhitelist = async () => {
    setIpStatus("");
  const res = await fetch(`${API_BASE_URL}/v1/profile/ip-whitelist/enable`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${localStorage.getItem("authToken")}` },
    });
    const data = await res.json();
    if (data.success) {
      setIpWhitelistEnabled(true);
      setIpStatus("IP Whitelist enabled.");
    } else {
      setIpStatus(data.error || "Failed to enable.");
    }
  };

  const handleDisableIpWhitelist = async () => {
    setIpStatus("");
  const res = await fetch(`${API_BASE_URL}/v1/profile/ip-whitelist/disable`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${localStorage.getItem("authToken")}` },
    });
    const data = await res.json();
    if (data.success) {
      setIpWhitelistEnabled(false);
      setIpStatus("IP Whitelist disabled.");
    } else {
      setIpStatus(data.error || "Failed to disable.");
    }
  };

  const handleAddIp = async () => {
    setIpStatus("");
  const res = await fetch(`${API_BASE_URL}/v1/profile/ip-whitelist/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("authToken")}` },
      body: JSON.stringify({ ip: newIp }),
    });
    const data = await res.json();
    if (data.success) {
      setIpList([...ipList, newIp]);
      setNewIp("");
      setIpStatus("IP added.");
    } else {
      setIpStatus(data.error || "Failed to add IP.");
    }
  };

  const handleRemoveIp = async (ip: string) => {
    setIpStatus("");
  const res = await fetch(`${API_BASE_URL}/v1/profile/ip-whitelist/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("authToken")}` },
      body: JSON.stringify({ ip }),
    });
    const data = await res.json();
    if (data.success) {
      setIpList(ipList.filter(i => i !== ip));
      setIpStatus("IP removed.");
    } else {
      setIpStatus(data.error || "Failed to remove IP.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Account Security Settings</h1>
      {/* Two-Factor Authentication Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Two-Factor Authentication (2FA)</h2>
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={twoFAEnabled} onChange={e => e.target.checked ? handleEnable2FA() : handleDisable2FA()} />
            Enable Two-Factor Authentication
          </label>
        </div>
        {qrCode && !twoFAEnabled && (
          <div className="mb-4">
            <img src={qrCode} alt="2FA QR Code" className="mx-auto mb-2" />
            <input
              type="text"
              placeholder="Enter code from app"
              value={twoFACode}
              onChange={e => setTwoFACode(e.target.value)}
              className="border rounded p-2 w-full mb-2"
            />
            <button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={handleVerify2FA}>Verify & Enable</button>
          </div>
        )}
        {twoFAStatus && <div className="text-green-600 mt-2">{twoFAStatus}</div>}
      </div>
      {/* IP Whitelist Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">IP Whitelist</h2>
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={ipWhitelistEnabled} onChange={e => e.target.checked ? handleEnableIpWhitelist() : handleDisableIpWhitelist()} />
            Enable IP Whitelist
          </label>
        </div>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Add IP address"
            value={newIp}
            onChange={e => setNewIp(e.target.value)}
            className="border rounded p-2 w-full mb-2"
          />
          <button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={handleAddIp}>Add IP</button>
        </div>
        <ul className="mb-4">
          {ipList.map(ip => (
            <li key={ip} className="flex items-center justify-between py-1">
              <span>{ip}</span>
              <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => handleRemoveIp(ip)}>Remove</button>
            </li>
          ))}
        </ul>
        {ipStatus && <div className="text-green-600 mt-2">{ipStatus}</div>}
      </div>
    </div>
  );
}
