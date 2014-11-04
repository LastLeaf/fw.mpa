// Copyright 2014 LastLeaf, LICENSE: github.lastleaf.me/MIT

// the FW env is used to override the most default fwconfig
var envConfig = process.env.FW;
if(envConfig.charAt(0) !== '{') {
	envConfig = { mode: envConfig };
} else {
	envConfig = JSON.parse(envConfig);
}

module.exports = {
	mode: (envConfig.mode || 'DEFAULT').toLowerCase(), // the running mode
	app: [], // the app(s) need to be initially started
	ip: envConfig.ip || '', // the ip address to bind, default binded to any address
	port: envConfig.port || [80], // the port(s) to bind (it may requires root privilege to bind to 80, and it's dangerous!)
	websocket: envConfig.websocket || true, // whether websocket should be enabled (some cloud platforms does not support websocket)
	heartbeat: envConfig.heartbeat || 25*1000, // the heartbeat to keep connections alive
};
