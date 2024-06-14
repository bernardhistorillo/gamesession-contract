const { ethers, upgrades } = require("hardhat");

async function main() {
    // Fetch the current gas price
    let gasPrice = await hre.run("fetch-gas-price");

    // Step 1: Deploy GameSession Contract

    // Get deployer account and validator account
    const [deployer, validator1, validator2] = await ethers.getSigners();

    console.log("Deploying GameSession...");

    // Compile and deploy the GameSession contract as an upgradeable contract
    const minimumBidAmount = ethers.parseEther("0.01"); // Set a minimum bid amount
    const maxPlayersPerSession = 3;
    const validators = [
        validator1.address,
        validator2.address,
    ];
    const GameSession = await ethers.getContractFactory("GameSession");
    const gameSession = await upgrades.deployProxy(GameSession, [deployer.address, validators, minimumBidAmount, maxPlayersPerSession], { initializer: 'initialize' });

    // Wait until the contract is deployed
    await gameSession.waitForDeployment();

    const contractAddress = await gameSession.getAddress();

    console.log("GameSession deployed to:", contractAddress);

    // Step 2: Testing the Contract

    // Get the ABI of the GameSession contract for interaction
    const gameSessionAbi = [
        "function createSession() public",
        "function placeBid(uint256 sessionId, uint256 tokens) public payable",
        "function claimPrize(uint256 sessionId, address winner, bytes memory signature) public",
        "function sessions(uint256 sessionId) view returns (uint256, bool)",
        "function getUserTokens(uint256 sessionId, address user) view returns (uint256)"
    ];

    // Interact with the deployed GameSession contract
    const gameSessionContract = new ethers.Contract(contractAddress, gameSessionAbi, deployer);

    let gasEstimate = await gameSessionContract.createSession.estimateGas();
    console.log(`Estimated transaction fee for createSession: ${gasPrice}`);
    console.log(gasEstimate);

    // Create a new session
    console.log("Creating new session...");
    const createSessionTx = await gameSessionContract.createSession({ gasPrice });
    await createSessionTx.wait();
    console.log("New session created");

    const sessionId = 1; // Assume first session

    // Define the user and tokens for the bid
    const user = deployer.address;
    const tokens = ethers.parseEther("0.02"); // Ensure this is above the minimum bid amount

    // Submit the bid
    console.log("Submitting bid...");
    const placeBidTx = await gameSessionContract.placeBid(sessionId, tokens, { value: tokens, gasPrice });
    await placeBidTx.wait();
    console.log("Bid placed:", placeBidTx.hash);

    // Check if the bid was recorded correctly
    const userTokens = await gameSessionContract.getUserTokens(sessionId, user);
    console.log(`User tokens after bid: ${userTokens.toString()}`);

    // Validators sign the sessionId and winner address
    const message = ethers.solidityPackedKeccak256(['uint256', 'address'], [sessionId, user]);
    const signature1 = await validator1.signMessage(ethers.toBeArray(message));
    const signature2 = await validator2.signMessage(ethers.toBeArray(message));
    // const signature3 = await validator3.signMessage(ethers.toBeArray(message));

    // Self-claim the prize
    const abi = ethers.AbiCoder.defaultAbiCoder();
    const signatures = abi.encode(
        ["bytes[]"],
        [ [
            signature1,
            signature2,
        ] ]);

    console.log("Claiming prize...");
    const claimPrizeTx = await gameSessionContract.claimPrize(sessionId, user, signatures, { gasPrice });

    await claimPrizeTx.wait();

    console.log("Prize claimed");
}

// Error handling
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
