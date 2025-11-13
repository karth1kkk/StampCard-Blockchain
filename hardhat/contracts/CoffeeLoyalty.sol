// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CoffeeLoyalty
 * @notice Handles BWT coffee purchases, stamp accruals, and reward redemption for the loyalty programme.
 */
contract CoffeeLoyalty is Ownable {
    IERC20 public immutable brewToken;
    uint256 public rewardThreshold;
    uint256 public rewardTokenAmount;

    mapping(address => uint256) private stampCount;
    mapping(address => uint256) private pendingRewards;
    mapping(address => uint256) private totalVolume;

    event CoffeePurchased(address indexed customer, uint256 priceInTokens, uint256 timestamp);
    event StampAdded(address indexed customer, uint256 stampBalance, uint256 pendingRewards);
    event RewardEarned(address indexed customer, uint256 totalPendingRewards);
    event RewardRedeemed(address indexed customer, uint256 remainingRewards, uint256 payoutAmount);
    event RewardThresholdUpdated(uint256 newThreshold);
    event RewardTokenAmountUpdated(uint256 newAmount);
    event RewardsFunded(address indexed owner, uint256 amount);
    event RewardsWithdrawn(address indexed owner, uint256 amount, address to);

    constructor(IERC20 _brewToken, uint256 _rewardThreshold, uint256 _rewardTokenAmount) Ownable(msg.sender) {
        require(address(_brewToken) != address(0), "Token address required");
        require(_rewardThreshold > 0, "Threshold must be positive");

        brewToken = _brewToken;
        rewardThreshold = _rewardThreshold;
        rewardTokenAmount = _rewardTokenAmount;
    }

    function buyCoffee(address customer, uint256 priceInTokens) external {
        require(customer != address(0), "Invalid customer");
        require(msg.sender == customer, "Caller must be customer");
        require(priceInTokens > 0, "Price must be positive");

        bool success = brewToken.transferFrom(customer, owner(), priceInTokens);
        require(success, "Token transfer failed");

        totalVolume[customer] += priceInTokens;
        emit CoffeePurchased(customer, priceInTokens, block.timestamp);

        _incrementStamps(customer);
    }

    function addStamp(address customer) external onlyOwner {
        require(customer != address(0), "Invalid customer");
        _incrementStamps(customer);
    }

    function redeemReward(address customer) external onlyOwner {
        require(customer != address(0), "Invalid customer");
        uint256 rewards = pendingRewards[customer];
        require(rewards > 0, "No rewards pending");

        pendingRewards[customer] = rewards - 1;

        uint256 payout = rewardTokenAmount;
        if (payout > 0) {
            require(brewToken.balanceOf(address(this)) >= payout, "Insufficient reward pool");
            bool success = brewToken.transfer(customer, payout);
            require(success, "Reward payout failed");
        }

        emit RewardRedeemed(customer, pendingRewards[customer], payout);
    }

    function fundRewards(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be positive");
        bool success = brewToken.transferFrom(owner(), address(this), amount);
        require(success, "Funding transfer failed");
        emit RewardsFunded(owner(), amount);
    }

    function withdrawRewards(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        bool success = brewToken.transfer(to, amount);
        require(success, "Withdraw failed");
        emit RewardsWithdrawn(owner(), amount, to);
    }

    function setRewardThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0, "Threshold must be positive");
        rewardThreshold = newThreshold;
        emit RewardThresholdUpdated(newThreshold);
    }

    function setRewardTokenAmount(uint256 newAmount) external onlyOwner {
        rewardTokenAmount = newAmount;
        emit RewardTokenAmountUpdated(newAmount);
    }

    function getStampCount(address customer) external view returns (uint256) {
        return stampCount[customer];
    }

    function getPendingRewards(address customer) external view returns (uint256) {
        return pendingRewards[customer];
    }

    function getTotalVolume(address customer) external view returns (uint256) {
        return totalVolume[customer];
    }

    function _incrementStamps(address customer) private {
        uint256 newCount = stampCount[customer] + 1;
        if (newCount >= rewardThreshold) {
            stampCount[customer] = newCount - rewardThreshold;
            pendingRewards[customer] += 1;
            emit RewardEarned(customer, pendingRewards[customer]);
        } else {
            stampCount[customer] = newCount;
        }

        emit StampAdded(customer, stampCount[customer], pendingRewards[customer]);
    }
}
