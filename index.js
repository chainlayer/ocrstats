require('dotenv').config()
const Web3 = require('web3')
const { sha3, keccak256 } = require('web3-utils')
const fetch = require('node-fetch')
const fs = require('fs')
const Web3Utils = require('web3-utils')
const util = require('ethereumjs-util')

const {
  CONTRACT,
  RPC_URL,
} = process.env
const params = {
  CONTRACT,
  RPC_URL,
}

const web3 = new Web3(RPC_URL)

// Get last config details
async function getlatestConfigDetails(blocknumber) {
  const body = {
    "jsonrpc": "2.0",
    "method": "eth_call",
    "params": [{
      "to": CONTRACT,
      "data":"0x81ff7048"
    }, blocknumber],
    "id": 74
  }
  const response = await fetch(RPC_URL, {
    body: JSON.stringify(body),
    method: 'POST',
    headers: {
      "accept": "application/json",
      "accept-language": "en-US,en;q=0.9,ru;q=0.8",
      "cache-control": "no-cache",
      "content-type": "application/json",
      "pragma": "no-cache"
    }
  })

  const { result } = await response.json()
  const data = web3.eth.abi.decodeParameters([{type:'uint32',name:'configCount'},{type:'uint32',name:'blockNumber'},{type:'bytes16',name:'configDigest'}],result)
  return data
}

// Get last config
async function getConfig(block) {
  const body = {
    "jsonrpc": "2.0",
    "method": "eth_getLogs",
    "params": [{
      "address": CONTRACT,
      "fromBlock": block,
      "toBlock": block,
      "topics": [
        "0x25d719d88a4512dd76c7442b910a83360845505894eb444ef299409e180f8fb9"
      ]
    }],
    "id": 74
  }
  const response = await fetch(RPC_URL, {
    body: JSON.stringify(body),
    method: 'POST',
    headers: {
      "accept": "application/json",
      "accept-language": "en-US,en;q=0.9,ru;q=0.8",
      "cache-control": "no-cache",
      "content-type": "application/json",
      "pragma": "no-cache"
    }
  })

  const { result } = await response.json()
  const data = web3.eth.abi.decodeLog([{type:'uint32',name:'previousConfigBlockNumber'},{type:'uint64',name:'configCount'},{type:'address[]',name:'signers',},{type:'address[]',name:'transmitters',},{type:'uint8',name:'threshold',},{type:'uint64',name:'encodedConfigVersion',},{type:'bytes',name:'encoded',}],
      result[0].data,
      result[0].topics);
  return data
}

// Get Last responses
async function getResponses(blocknumber) {
  const body = {
    "jsonrpc": "2.0",
    "method": "eth_getLogs",
    "params": [{
      "address": CONTRACT,
      "fromBlock": blocknumber,
      "toBlock": 'latest',
      "topics": [
        "0xf6a97944f31ea060dfde0566e4167c1a1082551e64b60ecb14d599a9d023d451"
      ]
    }],
    "id": 75
  }
  const response = await fetch(RPC_URL, {
    body: JSON.stringify(body),
    method: 'POST',
    headers: {
      "accept": "application/json",
      "accept-language": "en-US,en;q=0.9,ru;q=0.8",
      "cache-control": "no-cache",
      "content-type": "application/json",
      "pragma": "no-cache"
    }
  })

  const { result } = await response.json()
  const transmissions = []
  /*
  result.forEach(transmission => {
    const data = web3.eth.abi.decodeLog([{type:'uint32',name:'aggregatorRoundId',indexed:true},{type:'int192',name:'answer'},{type:'address',name:'transmitter'},{type:'int192[]',name:'observations'},{type:'bytes',name:'observers'},{type:'bytes32',name:'rawReportContext'}],
        transmission.data,
        transmission.topics);
    data.transactionHash = transmission.transactionHash
    data.blockNumber = transmission.blockNumber
    data.topics = transmission.topics
    transmissions.push(data)
  })
  // console.log(transmissions)
   */
  for (var a=0; a<result.length; a++) {
    transmission = result[a]
    const data = web3.eth.abi.decodeLog([{type:'uint32',name:'aggregatorRoundId',indexed:true},{type:'int192',name:'answer'},{type:'address',name:'transmitter'},{type:'int192[]',name:'observations'},{type:'bytes',name:'observers'},{type:'bytes32',name:'rawReportContext'}],
        transmission.data,
        transmission.topics);
    data.transactionHash = transmission.transactionHash
    data.blockNumber = transmission.blockNumber
    data.topics = transmission.topics

    const body2 = {
      "jsonrpc": "2.0",
      "method": "eth_getTransactionByHash",
      "params": [transmission.transactionHash],
      "id": 76
    }
    const response2 = await fetch(RPC_URL, {
      body: JSON.stringify(body2),
      method: 'POST',
      headers: {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9,ru;q=0.8",
        "cache-control": "no-cache",
        "content-type": "application/json",
        "pragma": "no-cache"
      }
    })
    const result2 = await response2.json()
    const input = result2.result.input
    const txdata = input.substr(10)
    const txdecodeddata = web3.eth.abi.decodeParameters([{
      type: 'bytes',
      name: 'report'
    },{
      type: 'bytes32[]',
      name: 'rs'
    },{
      type: 'bytes32[]',
      name: 'ss'
    },{
      type: 'bytes32',
      name: 'rawVs'
    }], txdata)
    vlist = Buffer.from(txdecodeddata.rawVs.substring(2,100), "hex")
    data.signerAddr = new Array()
    for (i = 0; i < txdecodeddata.rs.length; i++) {
      const v = parseInt(vlist[i])+27
      const pubKey = util.ecrecover(util.toBuffer(keccak256(txdecodeddata.report)), v, util.toBuffer(txdecodeddata.rs[i]), util.toBuffer(txdecodeddata.ss[i]));
      const addrBuf = util.pubToAddress(pubKey);
      const signerAddr = util.bufferToHex(addrBuf);
      data.signerAddr.push(signerAddr)
    }

    // Get Round and Epoch from txdecodeddata.report
    const reportdata = web3.eth.abi.decodeParameters([{
      type: 'bytes32',
      name: 'rawReportContext'
    },{
      type: 'bytes32',
      name: 'rawObservers'
    },{
      type: 'int192[]',
      name: 'observations'
    }], txdecodeddata.report);
    data.configdigest = reportdata.rawReportContext.substr(24,32)
    data.epoch = parseInt(reportdata.rawReportContext.substr(56,8), 16)
    data.round = parseInt(reportdata.rawReportContext.substr(64,2), 16)

    transmissions.push(data)
  }
  return transmissions
}

function findConfig(blocknumber) {
  // Loop through configs until we find one with a later blocknumber
  for (var i = 0; i<configs.length; i++) {
    config = configs[i]
    if (config.blockNumber>blocknumber) {
      return configs[i-1].configData
    }
  }
  return config.configData
}

async function main() {
  configs = new Array();
  var latestconfigdata = await getlatestConfigDetails('latest')
  var configblock = latestconfigdata.blockNumber

  var configData = await getConfig(Web3Utils.toHex(configblock))

  configs.push({ "blockNumber": latestconfigdata.blockNumber, "configDigest": latestconfigdata.configDigest, "configData": configData })
  for (var i = 1; i < configData.configCount; i++) {
    var latestconfigdata = await getlatestConfigDetails(Web3Utils.toHex(configData.previousConfigBlockNumber))
    var configblock = latestconfigdata.blockNumber
    var configData = await getConfig('0x' + Number(configblock).toString(16))
    configs.push({ "blockNumber": latestconfigdata.blockNumber, "configDigest": latestconfigdata.configDigest, "configData": configData })
  }

  // Sort configs
  configs.sort((a, b) => (a.blockNumber > b.blockNumber) ? 1 : -1)
  
  // first blocknumber 
  firstblock = latestconfigdata.blockNumber

  const transmissions = await getResponses(Web3Utils.toHex(firstblock))

  for (let transmission of transmissions) {
    let observers = Buffer.from(transmission.observers.substring(2,100), "hex")
    let observations = transmission.observations
    let round = parseInt(transmission.topics[1].substring(2,100),16)
    let blocknumber = parseInt(transmission.blockNumber, 16)
    configData = findConfig(blocknumber)
    console.log("## configData", configData)
    console.log("## transmission", transmission)
    let transmitters = configData.transmitters

    let i = 0
    let observationobject = new Array()
    for (let observation of observations) {
      let nodeidx = Number(observers[i])
      let observer = transmitters[nodeidx]
      observationobject.push({
        "nodeindex": nodeidx,
        "observer": transmitters[nodeidx],
        "observation": observation
      }) 
//      console.log(CONTRACT, round, transmission.transmitter, transmission.answer, observer, observation, blocknumber, transmission.transactionHash, transmission.epoch, transmission.round, transmission.signerAddr.join(","))
      i++
    }
    i=0
    for (let transmitter of transmitters) {
      let found = false
      for (let observer of observers) {
        if (i==observer) {
          found=true
        }
      }
      if (!found) {
//        console.log(CONTRACT, round, transmission.transmitter, transmission.answer, transmitter, 'missing', blocknumber, transmission.transactionHash, transmission.epoch, transmission.round, transmission.signerAddr.join(","))
        observationobject.push({
          "nodeindex": i,
          "observer": transmitters[i],
          "observation": null
        })
      }
      i++
    }
    console.log("round:", round, "observationobject:", observationobject)
  }
}

main()
