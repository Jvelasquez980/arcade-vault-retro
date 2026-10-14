import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["10.255.255.254", "192.168.1.57","*.trycloudflare.com"],
};

export default nextConfig;
