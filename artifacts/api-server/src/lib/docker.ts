import Dockerode from "dockerode";

function createDockerClient(): Dockerode {
  const isWindows = process.platform === "win32";
  if (isWindows) {
    return new Dockerode({ socketPath: "//./pipe/docker_engine" });
  }
  return new Dockerode({ socketPath: "/var/run/docker.sock" });
}

export const docker = createDockerClient();
