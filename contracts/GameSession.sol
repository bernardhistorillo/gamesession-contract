// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract GameSession is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    address public admin;
    address[] public validators;
    uint public sessionCounter;
    uint public minimumBidAmount;
    uint public maxPlayersPerSession;

    struct Session {
        uint totalPool;
        bool active;
        uint playerCount;
        mapping(address => uint) userTokens;
    }

    mapping(uint => Session) public sessions;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address[] memory _validators, uint _minimumBidAmount, uint _maxPlayersPerSession) initializer public {
        require(validators.length == _validators.length, "Invalid number of required signatures");
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        admin = initialOwner;
        validators = _validators;
        minimumBidAmount = _minimumBidAmount;
        maxPlayersPerSession = _maxPlayersPerSession;
    }

    function setMinimumBidAmount(uint _minimumBidAmount) public onlyOwner {
        minimumBidAmount = _minimumBidAmount;
    }

    function setMaxPlayersPerSession(uint _maxPlayersPerSession) public onlyOwner {
        maxPlayersPerSession = _maxPlayersPerSession;
    }

    function createSession() internal {
        sessionCounter++;
        sessions[sessionCounter].active = true;
    }

    function placeBid(uint tokens) public payable {
        require(tokens >= minimumBidAmount, "Bid amount is less than the minimum required");

        if (sessions[sessionCounter].playerCount >= maxPlayersPerSession) {
            createSession();
        }

        sessions[sessionCounter].userTokens[msg.sender] += tokens;
        sessions[sessionCounter].totalPool += tokens;
        sessions[sessionCounter].playerCount++;
    }

    function getUserTokens(uint sessionId, address user) public view returns (uint) {
        return sessions[sessionId].userTokens[user];
    }

    function claimPrize(uint sessionId, address winner, bytes memory signature) public {
        require(sessions[sessionId].active, "No active game session");
        require(sessions[sessionId].userTokens[winner] > 0, "No tokens placed by the winner");
        require(msg.sender == winner, "Only the winner can claim the prize");

        bytes[] memory signatures = abi.decode(signature, (bytes[]));
        require(signatures.length == validators.length, "Not enough signatures");

        bytes32 message = keccak256(abi.encodePacked(sessionId, winner));
        bytes32 messageHash = prefixed(message);

        for (uint i = 0; i < signatures.length; i++) {
            address signer = recoverSigner(messageHash, signatures[i]);
            require(signer == validators[i], "One of the signatures is invalid.");
        }

        uint256 prize = sessions[sessionId].totalPool;
        sessions[sessionId].totalPool = 0;
        sessions[sessionId].active = false;

        (bool success, ) = winner.call{value: prize}("");
        require(success, "Transfer failed");
    }

    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function recoverSigner(bytes32 messageHash, bytes memory signature) internal pure returns (address) {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(signature);
        return ecrecover(messageHash, v, r, s);
    }

    function splitSignature(bytes memory sig) internal pure returns (uint8, bytes32, bytes32) {
        require(sig.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        return (v, r, s);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}
}
