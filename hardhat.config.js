require("@nomicfoundation/hardhat-ethers");
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config();

task("fetch-gas-price", "Fetches the current gas price from Etherscan")
    .setAction(async () => {
      const axios = require('axios')
      const response = await axios.get(`https://api-sepolia.etherscan.io/api?module=proxy&action=eth_gasPrice&apikey=${process.env.ETHERSCAN_API_KEY}`);
      const gasPrice = BigInt(response.data.result);
      console.log(`Current gas price: ${gasPrice.toString()} wei`);
      return gasPrice;
    });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    defaultNetwork: "localhost",
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true
            }
        }
    },
    networks: {
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL,
            accounts: [
                `0x${process.env.DEPLOYER_PRIVATE_KEY}`,
                `0x${process.env.VALIDATOR_1_PRIVATE_KEY}`,
                `0x${process.env.VALIDATOR_2_PRIVATE_KEY}`,
            ],
        },
    }
};
