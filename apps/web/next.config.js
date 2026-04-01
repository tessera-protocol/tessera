/** @type {import('next').NextConfig} */
const isGuardControlPlane = process.env.GUARD_LOCAL_CONTROL_PLANE === "1";

const nextConfig = {
  ...(isGuardControlPlane ? {} : { output: "export" }),
};

module.exports = nextConfig;
