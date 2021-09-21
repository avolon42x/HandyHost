import {spawn} from 'child_process';
import fs from 'fs';
import https from 'https';
import generator from 'project-name-generator';
import {AKTUtils} from './Utils.js';
import QRCode from 'qrcode';
import {CommonUtils} from '../CommonUtils.js';

export class Wallet{
	constructor(){
		this.utils = new AKTUtils();
		this.commonUtils = new CommonUtils();
		this.AKASH_NETWORK = 'mainnet';
	}
	getState(){
		return new Promise((resolve,reject)=>{
			let exists = false;
			try{
				exists = fs.existsSync(`${process.env.HOME}/.akash/keyring-file`);
			}
			catch(e){
				exists = false;
			}
			console.log('akash exists??',exists);
			console.log("akash dir exists?",fs.existsSync(`${process.env.HOME}/.akash`));
			if(!exists){
				if(!fs.existsSync(`${process.env.HOME}/.akash`)){
					//akash needs inited
					this.initAkash().then(()=>{
						resolve({exists,initialized:true})
					}).catch(error=>{
						resolve({exists,initialized:false})
					})
				}
				else{
					resolve({exists,initialized:true})
				}
			}
			else{
				resolve({exists,initialized:true});
			}
		});
	}
	initAkash(){
		console.log('init akash');
		return new Promise((resolve,reject)=>{
			const options = {
				host: 'raw.githubusercontent.com',
				port:'443',
				path: `/ovrclk/net/master/${this.AKASH_NETWORK}/chain-id.txt`,
				method:'GET',
				rejectUnauthorized: true,
				requestCert: true,
				agent: false
			};
			const AKASH_NET = 'https://raw.githubusercontent.com/ovrclk/net/master/'+this.AKASH_NETWORK
			
			
			let CHAIN_ID = '';
			const request = https.request(options,response=>{
				//another chunk of data has been received, so append it to `str`
				
				response.on('data', (chunk) => {
					CHAIN_ID += chunk.toString().replace(/\n/gi,'').trim();
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					process.env.AKASH_CHAIN_ID = CHAIN_ID;
					process.env.AKASH_NET = AKASH_NET;
					const moniker = generator({words: 4}).dashed;
					process.env.AKASH_MONIKER = moniker;
					fs.writeFileSync(`${process.env.HOME}/.HandyHost/aktData/moniker`,moniker,'utf8');
					const s = spawn('./bin/akash',['init','--chain-id',CHAIN_ID,moniker],{env:process.env,cwd:process.env.HOME+'/.HandyHost/aktData'});
					console.log('init akt chain id',CHAIN_ID,moniker);
					/*s.stdout.on('data',d=>{
						console.log('stdout',d.toString());
					})
					s.stderr.on('data',d=>{
						console.log('stderr',d.toString());
					})*/
					s.on('close',()=>{
						this.fetchGenesis().then(()=>{
							this.addSeedsToConfig();
						}).catch(error=>{
							console.log('error fetching genesis',error);
						})
						
						resolve(moniker);
					})

					//resolve(json);

				});

				if(response.statusCode.toString() != '200'){
					//something went wrong
					reject(CHAIN_ID);
				}
			});
			request.end();
		});
	}
	fetchGenesis(){
		return new Promise((resolve,reject)=>{
			const options = {
				host: 'raw.githubusercontent.com',
				port:'443',
				path: `/ovrclk/net/master/${this.AKASH_NETWORK}/genesis.json`,
				method:'GET',
				rejectUnauthorized: true,
				requestCert: true,
				agent: false
			};
			let genesis = '';
			console.log('start genesis request');
			const request = https.request(options,response=>{
				response.on('data', (chunk) => {
					genesis += chunk;
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					console.log('finished fetching genesis')
					fs.writeFileSync(`${process.env.HOME}/.akash/config/genesis.json`,genesis,'utf8');
					resolve();
				});

				if(response.statusCode.toString() != '200'){
					//something went wrong
					reject(genesis)
					console.log('error getting genesis',response.statusCode.toString());
				}
			});
			request.end();
		});
		
	}
	addSeedsToConfig(){
		//get seeds from akash repo and add to config.toml
		const options = {
			host: 'raw.githubusercontent.com',
			port:'443',
			path: `/ovrclk/net/master/${this.AKASH_NETWORK}/seed-nodes.txt`,
			method:'GET',
			rejectUnauthorized: true,
			requestCert: true,
			agent: false
		};
		
		let seeds = '';
		const request = https.request(options,response=>{
			response.on('data', (chunk) => {
				seeds += chunk;
			});

			//the whole response has been received, so we just print it out here
			response.on('end', () => {
				//we got seeds newline separated, now inject into config
				let seedsCommaSeparated = seeds.trim().split('\n').filter(seed=>{
					return seed.length > 0;
				}).join(',');
				//this.utils.getConfigs().then(configData=>{
					//console.log('configs',configData);
					//configData.node.p2p.seeds.value = `"${seedsCommaSeparated}"`;
				this.utils.updateConfigs({
					node:{
						p2p:{
							seeds:`"${seedsCommaSeparated}"`
						}
					}
				}).then(updated=>{
					console.log('updated config',updated);
				}).catch(error=>{
					console.log('error updating config',error);
				})
				//});
			});

			if(response.statusCode.toString() != '200'){
				//something went wrong
				console.log('error getting seed nodes',response.statusCode.toString());
			}
		});
		request.end();
	}
	initWallet(pw,walletName){
		return new Promise((resolve,reject)=>{
			//const args = ['./createWallet.sh',this.commonUtils.escapeBashString(pw),this.commonUtils.escapeBashString(walletName)];
			let output = '';
			let errOutput = '';
			const args = [
				'--keyring-backend','file',
				'keys', 'add', this.commonUtils.escapeBashString(walletName)
			];
			const s = spawn(`${process.env.HOME}/.HandyHost/aktData/bin/akash`,args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			s.stdin.write(`${this.commonUtils.escapeBashString(pw)}\n`)
			s.stdin.write(`${this.commonUtils.escapeBashString(pw)}\n`)
			//const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
			    errOutput += d.toString();

			    //reject({'error':d.toString()})
			})
			s.stdin.end();
			s.on('close',d=>{
				if(output == '' && errOutput.indexOf('mnemonic') >= 0){
					reject({'error':errOutput});
				}
				else{
					//mnemonic comes back in stderr
					this.finishWalletInit(output,errOutput,walletName,false,resolve);
				}
			    
			})
			
		});
	}
	initWalletFromSeed(seed,pw,walletName){
		return new Promise((resolve,reject)=>{
			//const args = ['./recoverWallet.sh',`"${seed}"`,this.commonUtils.escapeBashString(pw),this.commonUtils.escapeBashString(walletName)];
			let output = '';
			let errOutput = '';
			
			/*
			#$1 = mnemonic
#$2 = pw
#$3 = walletname
(echo "$1"; echo "$2"; echo "$2") | $HOME/.HandyHost/aktData/bin/akash --keyring-backend file keys add "$3" --recover
			*/	
			const args = [
				'--keyring-backend', 'file',
				'keys', 'add', this.commonUtils.escapeBashString(walletName),
				'--recover'
			];
			const s = spawn(`${process.env.HOME}/.HandyHost/aktData/bin/akash`,args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			s.stdin.write(`${seed}\n`);
			s.stdin.write(`${this.commonUtils.escapeBashString(pw)}\n`);
			s.stdin.write(`${this.commonUtils.escapeBashString(pw)}\n`);
			//const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
			    errOutput += d.toString();
			    //reject({'error':d.toString()})
			})
			s.stdin.end();
			s.on('close',d=>{
				if(output == ''){
					reject({error:errOutput})
				}
			    //console.log('spawn closed',d);
			    this.finishWalletInit(output,errOutput,walletName,true,resolve);
			})
		});
	}
	finishWalletInit(output,stderrOutput,walletName,isInitFromSeed,resolve){
		const outputData = {};
		output.split('\n').filter(d=>{
	    	return d.length > 0;
	    }).map(rec=>{
	    	let parts = rec.split(':');
	    	if(parts.length > 1){
	    		let key = parts[0].trim().toLowerCase();
	    		if(key == '- name'){
	    			key = 'name';
	    		}
	    		if(!isInitFromSeed){
	    			outputData[key] = parts[1].trim();

	    		}
	    		else{
	    			if(key != 'mnemonic'){
	    				outputData[key] = parts[1].trim();
	    			}
	    		}
	    	}
	    })
	    if(typeof outputData.mnemonic != "undefined" && !isInitFromSeed){
	    	//get mnemonic from stderr
			let lines = stderrOutput.split('\n').filter(line=>{
				return line.length > 0;
			});
			outputData.mnemonic = lines[lines.length-1].trim();
			
	    }
	    fs.writeFileSync(`${process.env.HOME}/.HandyHost/aktData/.nodeEnv`,walletName,'utf8');
	    process.env.AKT_ACCT_NAME = walletName;
	    /*const newConfigParam = {
	    	node:{
	    		node:{
	    			from:`"${walletName}"`
	    		}
	    	}
	    };
	    this.updateConfigs(newConfigParam).then(d=>{
	    	resolve(outputData);
	    });*/
	    resolve(outputData);
	}
	getKeyList(pw){
		return new Promise((resolve,reject)=>{
			//const args = ['./listKeys.sh',this.commonUtils.escapeBashString(pw)];
			let output = '';
			const args = [
				'keys', 
				'list',
				'--keyring-backend', 'file'
			];
			const s = spawn(`${process.env.HOME}/.HandyHost/aktData/bin/akash`,args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			s.stdin.write(`${this.commonUtils.escapeBashString(pw)}\n`);
			s.stdin.write(`${this.commonUtils.escapeBashString(pw)}\n`);
			//const s = spawn('bash',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			//s.stdin.write('(echo derparoo;)');
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
			    console.log('stderr',d.toString());
			    reject({'error':d.toString()})
			})
			s.stdin.end();
			//TODO need to format properly for AKT
			s.on('close',d=>{
				const allowedKeys = ['name','address'];
				let outputData = [];
			    let nextRecord = {};
			    output.split('\n').filter(d=>{
			    	return d.length > 0;
			    }).map(rec=>{
			    	let parts = rec.split(':');
			    	if(parts.length > 1){
			    		if(parts[0].indexOf('- ') == 0){
			    			//console.log('set new record',nextRecord);
			    			if(Object.keys(nextRecord).length > 0){
			    				outputData.push(nextRecord);
			    			}
			    			nextRecord = {};
			    		}
			    		let key = parts[0].trim().toLowerCase().replace('- ','')
			    		if(allowedKeys.indexOf(key) >= 0){
			    			nextRecord[key] = parts[1].trim();
			    		}
			    	}
			    });
			    if(Object.keys(nextRecord).length > 0){
			    	outputData.push(nextRecord);
				}
			    resolve(outputData);
			})
		})
	}
	getQRCode(address){
		return new Promise((resolve,reject)=>{
			resolve(QRCode.toDataURL(address));
		})
		
	}
	getBalance(address){
		//TODO: get this balance from RPC instead

		return new Promise((resolve,reject)=>{
			//get public IP for them at least..
			const options = {
				host: 'lcd-akash.cosmostation.io',
				port:'443',
				path: `/cosmos/bank/v1beta1/balances/${address}`,
				method:'GET',
				rejectUnauthorized: true,
				requestCert: true,
				agent: false
			};
			let output = '';
			const request = https.request(options,response=>{
				response.on('data', (chunk) => {
					output += chunk;
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					this.getQRCode(address).then(qrData=>{
						const balanceData = {
							balance:JSON.parse(output),
							qr:qrData
						};
						resolve(balanceData);
					})
					
				});

				if(response.statusCode.toString() != '200'){
					//something went wrong
					console.log('error getting balance',response.statusCode.toString());
					reject(output);
				}
			});
			request.end();
			
		})
	}

	registerProvider(params,mode,providerHost){
		return new Promise((resolve,reject)=>{
			//console.log('register called',params,mode);
			const fees = typeof params.fees != "undefined" ? (params.fees == "" ? '10000' : params.fees) : '10000';
			//const args = ['./registerProvider.sh',this.commonUtils.escapeBashString(params.pw),this.commonUtils.escapeBashString(params.walletName),mode,fees];
			const args = [
				'tx', 'provider', mode,
				`${process.env.HOME}/.HandyHost/aktData/provider.yaml`,
				'--from', this.commonUtils.escapeBashString(params.walletName),
				`--home=${process.env.HOME}/.akash`,
				'--keyring-backend=file',
				`--node=${process.env.AKASH_NODE}`,
				`--chain-id=${process.env.AKASH_CHAIN_ID}`,
				'--fees', `${fees}uakt`,
				'--gas', 'auto',
				'-y'
			]
			const s = spawn(`${process.env.HOME}/.HandyHost/aktData/bin/akash`,args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
			let output = '';
			let errOutput = '';
			s.stdin.write(`${this.commonUtils.escapeBashString(params.pw)}\n`)
			s.stdout.on('data',d=>{
				output += d.toString();
			})
			s.stderr.on('data',d=>{
				errOutput += d.toString();
			})
			s.stdin.end();
			s.on('close',d=>{
				//console.log('output',output);
				if(output == '' && errOutput.length >= 0){
					if(errOutput.indexOf('invalid provider: already exists') && mode == 'create'){
						//try update, provider must have switched computers/cleaned disk...
						console.log('recurse, already exists',errOutput);
						this.registerProvider(params,'update',providerHost).then(d=>{
							resolve(d);
						}).catch(e=>{
							reject(e);
						})
					}
					else{
						reject({error:true,message:errOutput});
						return;
					}
				}
				else{
					//TODO set registration tx, return
					let jsonOut;
					try{
						jsonOut = JSON.parse(output);
					}
					catch(e){
						resolve({error:true,message:output});
						return;
					}
					const code = jsonOut.code;
					const codespace = jsonOut.codespace;

					if(codespace == 'provider' && code == 4){
						//redundant
						resolve({success:true,message:'Provider is already registered.'})
					}
					if(codespace == '' && code == 0){
						const {tx,wallet} = this.getMetaFromTransaction(jsonOut);
						fs.writeFileSync(process.env.HOME+'/.HandyHost/aktData/providerReceipt.'+wallet+'.json',JSON.stringify(jsonOut),'utf8');
						const actioned = mode == 'create' ? 'Registered' : 'Updated';
						if(params.generateCert){
							//console.log('done with tx 1, create cert now');
							this.createOrUpdateServerCertificate(params,wallet,providerHost).then(result=>{
								let serverMessageSuccess = '';
								let serverErrorMessage = '';
								if(result.success){
									serverMessageSuccess = ' and Server Certificate';
								}
								else{
									serverErrorMessage = '. However the Server Certificate failed due to: '+result.message;
								}
								resolve({success:true,tx,wallet,message:'Provider'+serverMessageSuccess+' '+actioned+' Successfully'+serverErrorMessage});
							})
						}
						else{
							resolve({success:true,tx,wallet,message:'Provider '+actioned+' Successfully'});
						}
						
					}
					if(codespace == 'sdk'){
						resolve({error:true,message:jsonOut.raw_log})
					}
					
				}
			    
			})
		});
	}
	checkProviderUpStatus(){
		return new Promise((resolve,reject)=>{
			const options = {
				host: '127.0.0.1',
				port:'8443',
				path: '/status',
				method:'GET',
				rejectUnauthorized: false,
				requestCert: true,
				agent: false
			};
			
			let output = '';
			const request = https.request(options,response=>{
				//another chunk of data has been received, so append it to `str`
				
				response.on('data', (chunk) => {
					output += chunk;
				});

				//the whole response has been received, so we just print it out here
				response.on('end', () => {
					let json = [];
					try{
						json = JSON.parse(output);
					}
					catch(e){
						console.log('bad json response',output.toString());
					}

					resolve(json);

				});

				if(response.statusCode.toString() != '200'){
					//something went wrong
					reject(output);
				}
			});

			request.on('error', (err)=> {
			    reject(err)
			});
			request.end();
		});
	}
	autostartProvider(){
		const autostartFile = process.env.HOME+'/.HandyHost/aktData/autostart.json';
		
		if(fs.existsSync(autostartFile)){
			const params = JSON.parse(fs.readFileSync(autostartFile,'utf8'));
			if(typeof process.env.AKTAUTO != "undefined"){
				const encFilePth = process.env.HOME+'/.HandyHost/keystore/'+process.env.AKTAUTO;
				if(fs.existsSync(encFilePath)){
					this.commonUtils.decrypt(encFilePath).then(pw=>{
						params.pw = pw;
						this.checkProviderUpStatus().then(d=>{
							console.log('autostart: akt provider is already running');
						}).catch(e=>{
							this.startProvider(params);
							
						})
					})
				}
				else{
					console.log('no akt enc autostart found')
				}
			}
			else{
				if(process.platform == 'darwin'){
					//is macos
					this.commonUtils.getDarwinKeychainPW('HANDYHOST_AKTAUTO').then(data=>{
						if(data.exists){
							params.pw = data.value;

							this.checkProviderUpStatus().then(d=>{
								console.log('autostart: akt provider is already running');
							}).catch(e=>{
								this.startProvider(params);
							})
						}
						else{
							console.log('no darwin akt autostart params exist');
						}
					})
				}
				else{
					console.log('no akt autostart params present')
				}
			}
			//this.startProvider(params);
		}
	}
	setupProviderAutostart(params,doAutostart){
		//auto start provider on app startup
		const autostartFile = process.env.HOME+'/.HandyHost/aktData/autostart.json';
		if(doAutostart){
			let stripped = JSON.parse(JSON.stringify(params));
			delete stripped.pw;
			fs.writeFileSync(autostartFile,JSON.stringify(stripped),'utf8');
			if(process.platform == 'darwin'){
				this.commonUtils.setDarwinKeychainPW(params.pw,'HANDYHOST_AKTAUTO');
			}	
			else{
				this.commonUtils.encrypt(params.pw,true,'akt');
			}
		}
		else{
			if(fs.existsSync(autostartFile)){
				fs.unlinkSync(autostartFile);
			}
		}
	}
	startProvider(params){
		
		//params = walletName,serverHost,prob password????
		return new Promise((resolve,reject)=>{
			let logInterval;
			//unfortunately this command doesnt accept a pw as stdin
			//so we encrypt to a readonly file and pass to the expect script
			//the expect script deletes the encrypted file after reading it.
			let opensslLoc;
			if(process.platform == 'darwin'){
				opensslLoc = '/usr/local/opt/openssl@1.1/bin/openssl'
			}
			else{
				opensslLoc = 'openssl'
			}
			this.commonUtils.encrypt(this.commonUtils.escapeBashString(params.pw)).then(pwLoc=>{
				const args = [pwLoc,this.commonUtils.escapeBashString(params.walletName),params.serverHost,params.cpuPrice,params.fees,opensslLoc];
				const s = spawn('./runProviderAutomated.sh',args,{env:process.env,cwd:process.env.PWD+'/aktAPI',detached:true});
				fs.writeFileSync(process.env.HOME+'/.HandyHost/aktData/provider.pid',s.pid.toString());
				let logsPath = process.env.HOME+'/.HandyHost/aktData/providerRun.log';
				if(fs.existsSync(logsPath)){
					//unlink if exists
					fs.unlinkSync(logsPath);
				}
				let intervalsPassed = 0;
				
				logInterval = setInterval(()=>{
					intervalsPassed += 1;
					if(intervalsPassed >= 180){
						intervalsPassed = 0;
						fs.truncateSync(logsPath); //clear logs
					}
					fs.appendFileSync(logsPath,output,'utf8');
					output = '';

				},10*1000);
				let hasReturned = false;
				let returnTimeout = setTimeout(()=>{
					if(!hasReturned){
						resolve({success:true});
					}
				},2000);
				
				let output = '';
				s.stdout.on('data',d=>{
					console.log('stdout',d.toString());
					output += d.toString();
				})
				s.stderr.on('data',d=>{
					console.log('stderr run provider:',d.toString());
					output += d.toString();
				})
				s.on('close',()=>{
					hasReturned = true;
					clearTimeout(returnTimeout);
					clearInterval(logInterval);
					resolve({success:false,error:output});
					if(fs.existsSync(process.env.HOME+'/.HandyHost/aktData/provider.pid')){
						fs.unlinkSync(process.env.HOME+'/.HandyHost/aktData/provider.pid');
					}
				})
			});
				
		});
	}
	haltProvider(){
		return new Promise((resolve,reject)=>{
			const pidPath = process.env.HOME+'/.HandyHost/aktData/provider.pid';
			if(fs.existsSync(pidPath)){
				const pid = parseInt(fs.readFileSync(pidPath,'utf8').trim());
				process.kill(pid);
				fs.unlinkSync(pidPath);
				resolve({success:true});
			}
			else{
				//ok must laready be dead
				resolve({success:true});
			}
		})
	}
	createOrUpdateServerCertificate(params,wallet,providerHost){
		//params = {pw,walletName}
		//if the provider registration was updated lets refresh/revoke the certificate in case they changed the server hostname/IP
		return new Promise((resolve,reject)=>{
			const certPath = process.env.HOME+'/.akash/'+wallet+'.pem';
			if(fs.existsSync(certPath)){
				//remove the cert
				fs.unlinkSync(certPath);
			}
			//confirm transaction before signing and broadcasting [y/N]: y
			let createOut = '';
			let errorOut = '';
			this.commonUtils.encrypt(this.commonUtils.escapeBashString(params.pw)).then(encPath=>{
				const openssl = process.platform == 'darwin' ? '/usr/local/opt/openssl@1.1/bin/openssl' : 'openssl';
				const fees = typeof params.fees != "undefined" ? (params.fees == "" ? '10000' : params.fees) : '10000';
				const args = [encPath,this.commonUtils.escapeBashString(params.walletName),providerHost,fees,openssl];
				let output = '';
				let errOutput = '';
				const s = spawn('./createProviderCertAutomated.sh',args,{shell:true,env:process.env,cwd:process.env.PWD+'/aktAPI'});
				s.stdout.on('data',d=>{
					output += d.toString();
				})
				s.stderr.on('data',d=>{
					errOutput += d.toString();
				})
				s.on('close',()=>{
					console.log('cert output',output)
					//console.log('cert err? ',errOutput);
					//all done, check if we did it..
					let successful = false;
					let message = '';
					const testStr = 'transaction successful:y';
					if(output.indexOf(testStr) >= 0){
						let json = {};
						const msgParts = output.split(testStr);
						try{
							json = JSON.parse(msgParts[1].trim());
						}
						catch(e){
							console.log("no json here");
							if(errOutput == ''){
								if(msgParts.length > 1){
									message = msgParts[1]
								}
								
							}
							else{
								message = errOutput;
							}
							
						}
						if(typeof json.code != "undefined"){
							if(json.code == 0){
								//success
								successful = true;
								message = 'Akash Server Certificate Generated Successfully';
							}
							else{
								message = json.raw_log;
							}
						}
						resolve({success:successful,message})
					}
					if(output == '' && errOutput != ''){
						resolve({success:successful,message:errOutput})
					}
				})
			})
			
		})
		

	}

	getMetaFromTransaction(receipt){
		const txID = receipt.txhash;
		let wallet;
		const meta = receipt.logs;
		if(meta.length > 0){
			meta[0].events.map(event=>{
				if(event.type == 'message'){
					const sender = event.attributes.find(attrib=>{
						return attrib.key == 'sender';
					})
					wallet = sender.value;
				}
			})
		}
		return {tx:txID,wallet};
	}
}