const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const OUTLET_ID = 1;
const DEFAULT_THRESHOLD = 8;

async function deployStampCardFixture() {
  const [owner, merchant, merchant2, customer, customer2] = await ethers.getSigners();
  const StampCard = await ethers.getContractFactory("StampCard");
  const stampCard = await StampCard.deploy(DEFAULT_THRESHOLD);
  return { stampCard, owner, merchant, merchant2, customer, customer2 };
}

async function signIssuance(stampCard, merchant, customer, outletId) {
  const nonce = await stampCard.getCustomerNonce(customer.address);
  const chain = await ethers.provider.getNetwork();
  const messageHash = ethers.solidityPackedKeccak256(
    ["address", "uint256", "uint256", "address", "uint256"],
    [customer.address, outletId, nonce, await stampCard.getAddress(), chain.chainId]
  );
  const signature = await merchant.signMessage(ethers.getBytes(messageHash));
  return ethers.AbiCoder.defaultAbiCoder().encode(["bytes", "uint256"], [signature, nonce]);
}

describe("StampCard", function () {
  describe("deployment", function () {
    it("sets owner and reward threshold", async function () {
      const { stampCard, owner } = await loadFixture(deployStampCardFixture);
      expect(await stampCard.owner()).to.equal(owner.address);
      expect(await stampCard.rewardThreshold()).to.equal(DEFAULT_THRESHOLD);
    });
  });

  describe("merchant authorization", function () {
    it("allows owner to authorize and revoke merchants", async function () {
      const { stampCard, owner, merchant } = await loadFixture(deployStampCardFixture);

      await expect(stampCard.connect(owner).authorizeMerchant(merchant.address))
        .to.emit(stampCard, "MerchantAuthorized")
        .withArgs(merchant.address);

      expect(await stampCard.isMerchantAuthorized(merchant.address)).to.be.true;

      await expect(stampCard.connect(owner).revokeMerchant(merchant.address))
        .to.emit(stampCard, "MerchantRevoked")
        .withArgs(merchant.address);

      expect(await stampCard.isMerchantAuthorized(merchant.address)).to.be.false;
    });

    it("prevents non-owners from authorizing merchants", async function () {
      const { stampCard, merchant, customer } = await loadFixture(deployStampCardFixture);
      await expect(
        stampCard.connect(customer).authorizeMerchant(merchant.address)
      ).to.be.revertedWithCustomError(stampCard, "OwnableUnauthorizedAccount");
    });
  });

  describe("issueStamp", function () {
    it("allows customer to issue stamp with authorized merchant signature", async function () {
      const { stampCard, owner, merchant, customer } = await loadFixture(deployStampCardFixture);
      await stampCard.connect(owner).authorizeMerchant(merchant.address);

      const signature = await signIssuance(stampCard, merchant, customer, OUTLET_ID);

      await expect(
        stampCard.connect(customer).issueStamp(customer.address, OUTLET_ID, signature)
      )
        .to.emit(stampCard, "StampIssued")
        .withArgs(customer.address, OUTLET_ID, 1);

      expect(await stampCard.getStampCount(customer.address)).to.equal(1);
      expect(await stampCard.balanceOf(customer.address, OUTLET_ID)).to.equal(1);
      expect(await stampCard.getCustomerNonce(customer.address)).to.equal(1);
    });

    it("mints reward after reaching threshold", async function () {
      const { stampCard, owner, merchant, customer } = await loadFixture(deployStampCardFixture);
      await stampCard.connect(owner).authorizeMerchant(merchant.address);

      for (let i = 0; i < DEFAULT_THRESHOLD - 1; i++) {
        const sig = await signIssuance(stampCard, merchant, customer, OUTLET_ID);
        await stampCard.connect(customer).issueStamp(customer.address, OUTLET_ID, sig);
      }

      const finalSig = await signIssuance(stampCard, merchant, customer, OUTLET_ID);
      await expect(stampCard.connect(customer).issueStamp(customer.address, OUTLET_ID, finalSig))
        .to.emit(stampCard, "RewardGranted")
        .withArgs(customer.address, 1);

      expect(await stampCard.getRewardCount(customer.address)).to.equal(1);
      expect(await stampCard.balanceOf(customer.address, 0)).to.equal(1);
    });

    it("rejects duplicate signatures", async function () {
      const { stampCard, owner, merchant, customer } = await loadFixture(deployStampCardFixture);
      await stampCard.connect(owner).authorizeMerchant(merchant.address);

      const signature = await signIssuance(stampCard, merchant, customer, OUTLET_ID);

      await stampCard.connect(customer).issueStamp(customer.address, OUTLET_ID, signature);

      await expect(
        stampCard.connect(customer).issueStamp(customer.address, OUTLET_ID, signature)
      ).to.be.revertedWith("Challenge already used");
    });

    it("rejects unauthorized merchant signatures", async function () {
      const { stampCard, merchant2, customer } = await loadFixture(deployStampCardFixture);
      const signature = await signIssuance(stampCard, merchant2, customer, OUTLET_ID);

      await expect(
        stampCard.connect(customer).issueStamp(customer.address, OUTLET_ID, signature)
      ).to.be.revertedWith("Merchant not authorized");
    });

    it("requires caller to match customer", async function () {
      const { stampCard, owner, merchant, customer, customer2 } = await loadFixture(deployStampCardFixture);
      await stampCard.connect(owner).authorizeMerchant(merchant.address);
      const signature = await signIssuance(stampCard, merchant, customer, OUTLET_ID);

      await expect(
        stampCard.connect(customer2).issueStamp(customer.address, OUTLET_ID, signature)
      ).to.be.revertedWith("Caller must be customer");
    });
  });

  describe("redeemReward", function () {
    it("allows customer to redeem reward they earned", async function () {
      const { stampCard, owner, merchant, customer } = await loadFixture(deployStampCardFixture);
      await stampCard.connect(owner).authorizeMerchant(merchant.address);

      for (let i = 0; i < DEFAULT_THRESHOLD; i++) {
        const signature = await signIssuance(stampCard, merchant, customer, OUTLET_ID);
        await stampCard.connect(customer).issueStamp(customer.address, OUTLET_ID, signature);
      }

      await expect(stampCard.connect(customer).redeemReward(customer.address))
        .to.emit(stampCard, "RewardRedeemed")
        .withArgs(customer.address, 0);

      expect(await stampCard.getRewardCount(customer.address)).to.equal(0);
      expect(await stampCard.balanceOf(customer.address, 0)).to.equal(0);
    });

    it("blocks redeeming when no rewards remain", async function () {
      const { stampCard, customer } = await loadFixture(deployStampCardFixture);

      await expect(
        stampCard.connect(customer).redeemReward(customer.address)
      ).to.be.revertedWith("No rewards to redeem");
    });

    it("prevents others from redeeming on behalf of customer", async function () {
      const { stampCard, owner, merchant, customer, customer2 } = await loadFixture(deployStampCardFixture);
      await stampCard.connect(owner).authorizeMerchant(merchant.address);

      for (let i = 0; i < DEFAULT_THRESHOLD; i++) {
        const signature = await signIssuance(stampCard, merchant, customer, OUTLET_ID);
        await stampCard.connect(customer).issueStamp(customer.address, OUTLET_ID, signature);
      }

      await expect(
        stampCard.connect(customer2).redeemReward(customer.address)
      ).to.be.revertedWith("Caller must be customer");
    });
  });

  describe("view helpers", function () {
    it("reports stamp and reward counts per customer", async function () {
      const { stampCard, owner, merchant, customer, customer2 } = await loadFixture(deployStampCardFixture);
      await stampCard.connect(owner).authorizeMerchant(merchant.address);

      const sig1 = await signIssuance(stampCard, merchant, customer, OUTLET_ID);
      await stampCard.connect(customer).issueStamp(customer.address, OUTLET_ID, sig1);

      for (let i = 0; i < DEFAULT_THRESHOLD; i++) {
        const sig = await signIssuance(stampCard, merchant, customer2, OUTLET_ID + 1);
        await stampCard.connect(customer2).issueStamp(customer2.address, OUTLET_ID + 1, sig);
      }

      expect(await stampCard.getStampCount(customer.address)).to.equal(1);
      expect(await stampCard.getRewardCount(customer.address)).to.equal(0);
      expect(await stampCard.getStampCount(customer2.address)).to.equal(DEFAULT_THRESHOLD);
      expect(await stampCard.getRewardCount(customer2.address)).to.equal(1);
    });

    it("allows owner to adjust reward threshold", async function () {
      const { stampCard, owner } = await loadFixture(deployStampCardFixture);
      await expect(stampCard.connect(owner).setRewardThreshold(10))
        .to.emit(stampCard, "RewardThresholdUpdated")
        .withArgs(10);
      expect(await stampCard.rewardThreshold()).to.equal(10);
    });
  });
});

