// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ScanDrop Reward Campaign
/// @notice Distributes a fixed amount of native AVAX once per wallet.
contract RewardCampaign {
    address public immutable owner;
    uint256 public immutable rewardAmount;
    uint64 public endTime;
    uint256 public totalClaims;
    bool public paused;

    mapping(address account => bool claimed) public hasClaimed;

    bool private locked;

    error AlreadyClaimed();
    error CampaignEnded();
    error CampaignPaused();
    error CampaignStillActive();
    error InsufficientCampaignBalance();
    error InvalidConfiguration();
    error NotOwner();
    error TransferFailed();

    event CampaignFunded(address indexed sender, uint256 amount, uint256 newBalance);
    event CampaignPauseChanged(bool paused);
    event CampaignExtended(uint64 previousEndTime, uint64 newEndTime);
    event RewardClaimed(address indexed account, uint256 amount, uint256 indexed claimNumber);
    event RemainingFundsWithdrawn(address indexed owner, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert TransferFailed();
        locked = true;
        _;
        locked = false;
    }

    constructor(uint256 rewardAmountWei, uint64 campaignEndTime) payable {
        if (rewardAmountWei == 0 || campaignEndTime <= block.timestamp) {
            revert InvalidConfiguration();
        }

        owner = msg.sender;
        rewardAmount = rewardAmountWei;
        endTime = campaignEndTime;

        if (msg.value > 0) {
            emit CampaignFunded(msg.sender, msg.value, msg.value);
        }
    }

    receive() external payable {
        emit CampaignFunded(msg.sender, msg.value, address(this).balance);
    }

    /// @notice Claim the campaign reward. Each wallet may call this once.
    function claim() external nonReentrant {
        if (paused) revert CampaignPaused();
        if (block.timestamp >= endTime) revert CampaignEnded();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        if (address(this).balance < rewardAmount) {
            revert InsufficientCampaignBalance();
        }

        hasClaimed[msg.sender] = true;
        totalClaims += 1;

        (bool sent, ) = payable(msg.sender).call{value: rewardAmount}("");
        if (!sent) revert TransferFailed();

        emit RewardClaimed(msg.sender, rewardAmount, totalClaims);
    }

    function remainingClaims() external view returns (uint256) {
        return address(this).balance / rewardAmount;
    }

    function setPaused(bool shouldPause) external onlyOwner {
        paused = shouldPause;
        emit CampaignPauseChanged(shouldPause);
    }

    function extendCampaign(uint64 newEndTime) external onlyOwner {
        if (newEndTime <= endTime || newEndTime <= block.timestamp) {
            revert InvalidConfiguration();
        }

        uint64 previousEndTime = endTime;
        endTime = newEndTime;
        emit CampaignExtended(previousEndTime, newEndTime);
    }

    /// @notice Recover unused AVAX after the campaign is paused or has ended.
    function withdrawRemaining() external onlyOwner nonReentrant {
        if (!paused && block.timestamp < endTime) revert CampaignStillActive();

        uint256 amount = address(this).balance;
        (bool sent, ) = payable(owner).call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit RemainingFundsWithdrawn(owner, amount);
    }
}
