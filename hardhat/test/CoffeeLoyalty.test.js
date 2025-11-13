const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18);
const DEFAULT_THRESHOLD = 8;
const DEFAULT_REWARD = ethers.parseUnits("5", 18);

async function deployFixture() {
  const [owner, customer, other] = await ethers.getSigners();

  const BrewToken = await ethers.getContractFactory("BrewToken");
  const brewToken = await BrewToken.deploy(INITIAL_SUPPLY);

  const CoffeeLoyalty = await ethers.getContractFactory("CoffeeLoyalty");
  const coffeeLoyalty = await CoffeeLoyalty.deploy(
    await brewToken.getAddress(),
    DEFAULT_THRESHOLD,
    DEFAULT_REWARD
  );

  return { owner, customer, other, brewToken, coffeeLoyalty };
}

async function fundRewardPool({ owner, brewToken, coffeeLoyalty }, amount = DEFAULT_REWARD * 10n) {
  await brewToken.connect(owner).approve(await coffeeLoyalty.getAddress(), amount);
  await coffeeLoyalty.connect(owner).fundRewards(amount);
}

describe("CoffeeLoyalty", function () {
  describe("deployment", function () {
    it("sets token, threshold, and reward info", async function () {
      const { owner, brewToken, coffeeLoyalty } = await loadFixture(deployFixture);
      expect(await coffeeLoyalty.owner()).to.equal(owner.address);
      expect(await coffeeLoyalty.rewardThreshold()).to.equal(DEFAULT_THRESHOLD);
      expect(await coffeeLoyalty.rewardTokenAmount()).to.equal(DEFAULT_REWARD);
      expect(await coffeeLoyalty.brewToken()).to.equal(await brewToken.getAddress());
    });
  });

  describe("buyCoffee", function () {
    it("transfers tokens to the merchant and issues stamps", async function () {
      const { owner, customer, brewToken, coffeeLoyalty } = await loadFixture(deployFixture);
      const price = ethers.parseUnits("3.5", 18);

      await brewToken.connect(owner).transfer(customer.address, price);
      await brewToken.connect(customer).approve(await coffeeLoyalty.getAddress(), price);

      await expect(coffeeLoyalty.connect(customer).buyCoffee(customer.address, price))
        .to.emit(coffeeLoyalty, "CoffeePurchased")
        .withArgs(customer.address, price, anyValue);

      expect(await brewToken.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
      expect(await coffeeLoyalty.getStampCount(customer.address)).to.equal(1);
      expect(await coffeeLoyalty.getPendingRewards(customer.address)).to.equal(0);
      expect(await coffeeLoyalty.getTotalVolume(customer.address)).to.equal(price);
    });

    it("awards pending reward after reaching threshold", async function () {
      const { owner, customer, brewToken, coffeeLoyalty } = await loadFixture(deployFixture);
      const price = ethers.parseUnits("2", 18);
      const total = price * BigInt(DEFAULT_THRESHOLD);

      await brewToken.connect(owner).transfer(customer.address, total);
      await brewToken.connect(customer).approve(await coffeeLoyalty.getAddress(), total);

      for (let i = 0; i < DEFAULT_THRESHOLD; i++) {
        await coffeeLoyalty.connect(customer).buyCoffee(customer.address, price);
      }

      expect(await coffeeLoyalty.getStampCount(customer.address)).to.equal(0);
      expect(await coffeeLoyalty.getPendingRewards(customer.address)).to.equal(1);
    });

    it("rejects calls from non customers", async function () {
      const { customer, other, coffeeLoyalty } = await loadFixture(deployFixture);
      await expect(
        coffeeLoyalty.connect(other).buyCoffee(customer.address, 1)
      ).to.be.revertedWith("Caller must be customer");
    });
  });

  describe("addStamp", function () {
    it("allows owner to award a stamp", async function () {
      const { owner, customer, coffeeLoyalty } = await loadFixture(deployFixture);
      await expect(coffeeLoyalty.connect(owner).addStamp(customer.address))
        .to.emit(coffeeLoyalty, "StampAdded")
        .withArgs(customer.address, 1, 0);
    });

    it("blocks non owner calls", async function () {
      const { customer, other, coffeeLoyalty } = await loadFixture(deployFixture);
      await expect(
        coffeeLoyalty.connect(other).addStamp(customer.address)
      ).to.be.revertedWithCustomError(coffeeLoyalty, "OwnableUnauthorizedAccount");
    });
  });

  describe("redeemReward", function () {
    it("processes pending rewards and pays out tokens", async function () {
      const { owner, customer, brewToken, coffeeLoyalty } = await loadFixture(deployFixture);
      const price = ethers.parseUnits("2", 18);
      const total = price * BigInt(DEFAULT_THRESHOLD);

      await brewToken.connect(owner).transfer(customer.address, total);
      await brewToken.connect(customer).approve(await coffeeLoyalty.getAddress(), total);

      for (let i = 0; i < DEFAULT_THRESHOLD; i++) {
        await coffeeLoyalty.connect(customer).buyCoffee(customer.address, price);
      }

      await fundRewardPool({ owner, brewToken, coffeeLoyalty }, DEFAULT_REWARD * 2n);

      await expect(coffeeLoyalty.connect(owner).redeemReward(customer.address))
        .to.emit(coffeeLoyalty, "RewardRedeemed")
        .withArgs(customer.address, 0, DEFAULT_REWARD);

      expect(await coffeeLoyalty.getPendingRewards(customer.address)).to.equal(0);
      expect(await brewToken.balanceOf(customer.address)).to.equal(DEFAULT_REWARD);
    });

    it("prevents redemption without rewards", async function () {
      const { owner, customer, coffeeLoyalty } = await loadFixture(deployFixture);
      await expect(
        coffeeLoyalty.connect(owner).redeemReward(customer.address)
      ).to.be.revertedWith("No rewards pending");
    });

    it("blocks non owner redemption", async function () {
      const { customer, other, coffeeLoyalty } = await loadFixture(deployFixture);
      await expect(
        coffeeLoyalty.connect(other).redeemReward(customer.address)
      ).to.be.revertedWithCustomError(coffeeLoyalty, "OwnableUnauthorizedAccount");
    });
  });

  describe("owner controls", function () {
    it("updates reward options", async function () {
      const { owner, coffeeLoyalty } = await loadFixture(deployFixture);
      await coffeeLoyalty.connect(owner).setRewardThreshold(5);
      await coffeeLoyalty.connect(owner).setRewardTokenAmount(123);
      expect(await coffeeLoyalty.rewardThreshold()).to.equal(5);
      expect(await coffeeLoyalty.rewardTokenAmount()).to.equal(123);
    });

    it("handles funding and withdrawing reward pool", async function () {
      const { owner, brewToken, coffeeLoyalty } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("100", 18);
      await fundRewardPool({ owner, brewToken, coffeeLoyalty }, amount);
      expect(await brewToken.balanceOf(await coffeeLoyalty.getAddress())).to.equal(amount);

      await coffeeLoyalty.connect(owner).withdrawRewards(owner.address, amount / 2n);
      expect(await brewToken.balanceOf(await coffeeLoyalty.getAddress())).to.equal(amount / 2n);
    });
  });
});
