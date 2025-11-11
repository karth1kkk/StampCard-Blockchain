// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title StampCard
 * @dev ERC-1155 based loyalty contract that supports merchant-authorized stamp issuance.
 */
contract StampCard is ERC1155, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    uint256 public constant REWARD_TOKEN_ID = 0;

    uint256 public rewardThreshold;

    mapping(address => uint256) private stampCount;
    mapping(address => uint256) private rewardCount;
    mapping(address => bool) private authorizedMerchants;
    mapping(address => uint256) private customerNonces;
    mapping(bytes32 => bool) private usedMessages;

    event StampIssued(address indexed customer, uint256 indexed outletId, uint256 totalStamps);
    event RewardGranted(address indexed customer, uint256 rewardCount);
    event RewardRedeemed(address indexed customer, uint256 remainingRewards);
    event MerchantAuthorized(address indexed merchant);
    event MerchantRevoked(address indexed merchant);
    event RewardThresholdUpdated(uint256 newThreshold);

    constructor(uint256 initialRewardThreshold) ERC1155("https://stampcard.com/api/token/{id}.json") Ownable(msg.sender) {
        require(initialRewardThreshold > 0, "Reward threshold must be positive");
        rewardThreshold = initialRewardThreshold;
    }

    function authorizeMerchant(address merchant) external onlyOwner {
        require(merchant != address(0), "Invalid merchant");
        authorizedMerchants[merchant] = true;
        emit MerchantAuthorized(merchant);
    }

    function revokeMerchant(address merchant) external onlyOwner {
        require(authorizedMerchants[merchant], "Merchant not authorized");
        authorizedMerchants[merchant] = false;
        emit MerchantRevoked(merchant);
    }

    function setRewardThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0, "Reward threshold must be positive");
        rewardThreshold = newThreshold;
        emit RewardThresholdUpdated(newThreshold);
    }

    function issueStamp(address customer, uint256 outletId, bytes calldata merchantSig) external {
        require(msg.sender == customer, "Caller must be customer");
        require(customer != address(0), "Invalid customer");
        require(outletId != 0, "Invalid outlet");

        (bytes memory rawSignature, uint256 providedNonce) = abi.decode(merchantSig, (bytes, uint256));
        require(rawSignature.length == 65, "Invalid signature length");

        uint256 nonce = customerNonces[customer];
        if (providedNonce < nonce) {
            revert("Challenge already used");
        }
        require(providedNonce == nonce, "Invalid nonce");

        bytes32 messageHash = keccak256(
            abi.encodePacked(customer, outletId, nonce, address(this), block.chainid)
        );
        bytes32 ethSignedMessage = messageHash.toEthSignedMessageHash();

        require(!usedMessages[ethSignedMessage], "Challenge already used");

        address merchantSigner = ethSignedMessage.recover(rawSignature);
        require(authorizedMerchants[merchantSigner], "Merchant not authorized");

        usedMessages[ethSignedMessage] = true;
        customerNonces[customer] = nonce + 1;

        uint256 newStampTotal = stampCount[customer] + 1;
        stampCount[customer] = newStampTotal;

        _mint(customer, outletId, 1, "");

        emit StampIssued(customer, outletId, newStampTotal);

        if (newStampTotal % rewardThreshold == 0) {
            rewardCount[customer] += 1;
            _mint(customer, REWARD_TOKEN_ID, 1, "");
            emit RewardGranted(customer, rewardCount[customer]);
        }
    }

    function redeemReward(address customer) external {
        require(msg.sender == customer, "Caller must be customer");
        require(rewardCount[customer] > 0, "No rewards to redeem");

        rewardCount[customer] -= 1;
        _burn(customer, REWARD_TOKEN_ID, 1);

        emit RewardRedeemed(customer, rewardCount[customer]);
    }

    function getStampCount(address customer) external view returns (uint256) {
        return stampCount[customer];
    }

    function getRewardCount(address customer) external view returns (uint256) {
        return rewardCount[customer];
    }

    function isMerchantAuthorized(address merchant) external view returns (bool) {
        return authorizedMerchants[merchant];
    }

    function getCustomerNonce(address customer) external view returns (uint256) {
        return customerNonces[customer];
    }
}

