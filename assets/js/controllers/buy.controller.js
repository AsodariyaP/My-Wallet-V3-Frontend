angular
  .module('walletApp')
  .controller('BuyCtrl', BuyCtrl);

function BuyCtrl ($rootScope, $scope, MyWallet, Wallet, Alerts, currency, $uibModalInstance, $uibModal, country, exchange, trades, fiat, trade) {
  $scope.settings = Wallet.settings;
  $scope.btcCurrency = $scope.settings.btcCurrency;
  $scope.userHasExchangeAcct = trades.pending.length || trades.completed.length;
  $scope.currencies = currency.coinifyCurrencies;
  $scope.profile = MyWallet.wallet.profile;
  $scope.countries = country;
  $scope.user = Wallet.user;
  $scope.exchange = exchange;
  $scope.trades = trades;
  $scope.alerts = [];
  $scope.status = {};
  $scope.trade = trade;
  $scope.step = 0;

  $scope.fields = { email: $scope.user.email };
  $scope.bank = { name: 'Bank Account', fee: 0 };
  $scope.creditcard = { name: 'Credit/Debit', fee: 2.75 };
  $scope.method = $scope.creditcard;
  $scope.transaction = {fiat: 0, btc: 0, fee: 0, total: 0, currency: $scope.settings.currency};
  $scope.transaction.fiat = fiat || 0;

  $scope.changeCurrency = (curr) => {
    if (!curr) curr = $scope.settings.currency;

    const error = () => {};
    const success = () => { $scope.transaction.currency = curr; };

    Wallet.changeCurrency(curr).then(success, error);
  };

  $scope.standardError = (err) => {
    console.log(err);
    $scope.status = {};
    try {
      let e = JSON.parse(err);
      let msg = e.error.toUpperCase();
      if (msg === 'EMAIL_ADDRESS_IN_USE') $scope.rejectedEmail = true;
      else Alerts.displayError(msg, true, $scope.alerts, {user: $scope.exchange.user});
    } catch (e) {
      if (e.error) Alerts.displayError(e.error);
      else Alerts.displayError('INVALID_REQUEST', true, $scope.alerts);
    }
  };

  $scope.fetchProfile = () => {
    $scope.status.waiting = true;
    const success = () => {
      $scope.status = {};
    };

    return $scope.exchange.fetchProfile().then(success, $scope.standardError);
  };

  $scope.updateAmounts = () => {
    if (!$scope.quote) return;
    if (!$scope.exchange && !$scope.exchange.user) return;
    let fiatAmt = $scope.transaction.fiat;
    let methodFee = fiatAmt * ($scope.method.fee / 100);

    $scope.transaction.methodFee = methodFee.toFixed(2);
    $scope.transaction.btc = currency.formatCurrencyForView($scope.quote.quoteAmount / 10000, currency.bitCurrencies[0]);
    $scope.transaction.total = fiatAmt +
                               +$scope.transaction.methodFee;
  };

  // $scope.verifyConfirmationCode = (code, successCallback, errorCallback) => {
  //   const success = () => {
  //     $scope.user.isEmailVerified = true;
  //     successCallback();
  //     $scope.nextStep();
  //   };

  //   const error = (err) => $scope.standardError(err); errorCallback();

  //   Wallet.verifyEmail($scope.confirmationCode.bcAsyncForm.input.$viewValue, success, error);
  // };

  // move to directive
  $scope.getQuote = () => {
    if (!$scope.exchange) return;
    if (!$scope.exchange.user) return;

    $scope.transaction.btc = 0;
    $scope.quote = null;

    let amt = $scope.transaction.fiat;
    let curr = $scope.transaction.currency.code;
    if (!amt) return;
    $scope.status.waiting = true;

    const success = (quote) => {
      $scope.status = {};
      $scope.quote = quote;
      $scope.updateAmounts();
      Alerts.clear($scope.alerts);
    };

    $scope.exchange.getQuote(amt, curr).then(success, $scope.standardError);
  };

  $scope.toggleEmail = () => $scope.editEmail = !$scope.editEmail;

  $scope.addExchange = () => {
    if (!$scope.profile.countryCode) return;
    if (!MyWallet.wallet.external.coinify) MyWallet.wallet.external.addCoinify();
    $scope.exchange = MyWallet.wallet.external.coinify;
    $scope.partner = 'Coinify';
  };

  $scope.nextStep = () => {
    if (!$scope.transaction.fiat) {
      $scope.step = 0;
    } else if (!$scope.profile.countryCode) {
      $scope.step = 1;
    } else if (!$scope.user.isEmailVerified) {
      $scope.step = 2;
    } else if ($scope.rejectedEmail) {
      $scope.step = 2;
    } else if (!$scope.exchange || !$scope.exchange.user) {
      $scope.step = 3;
    } else if (!$scope.trade) {
      $scope.step = 4;
    } else {
      $scope.step = 5;
    }
  };

  $scope.prevStep = () => {
    try {
      if ($scope.exchange.user) {
        $scope.step = 0;
      } else if ($scope.step > 2) {
        $scope.step = 1;
      } else {
        $scope.step--;
      }
    } catch (e) {
      $scope.step--;
    }
  };

  $scope.isDisabled = () => {
    if ($scope.step === 0) {
      return !($scope.transaction.fiat > 0);
    } else if ($scope.step === 1) {
      return !$scope.profile.countryCode;
    } else if ($scope.step === 3) {
      return !$scope.signupForm.$valid;
    }
  };

  $scope.changeEmail = (email, successCallback, errorCallback) => {
    $scope.rejectedEmail = undefined;

    const success = () => {
      Alerts.clear($scope.alerts);
      $scope.editEmail = false; successCallback();
    };
    const error = () => $scope.editEmail = false; errorCallback();

    Wallet.changeEmail(email, success, error);
  };

  $scope.signup = () => {
    $scope.status.waiting = true;

    const success = () => {
      $scope.status = {};
      Alerts.clear($scope.alerts);
      $scope.fetchProfile().then($scope.getQuote);
    };

    $scope.exchange.signup()
      .then(success).catch($scope.standardError);
  };

  $scope.buy = () => {
    $scope.status.waiting = true;

    const success = (trade) => {
      Alerts.clear($scope.alerts);
      $scope.trade = trade;
    };

    $scope.exchange.buy(-$scope.transaction.fiat).then(success, $scope.standardError);
  };

  $scope.loadISX = () => {
    if ($scope.step === 5) return;
    $scope.status = {};
    $scope.nextStep();
  };

  $scope.decline = () => {
    $scope.cancel();
    Alerts.confirm('DECLINED_TRANSACTION', {}, '', 'TRY_AGAIN', {}).then(() => {
      $rootScope.$broadcast('initBuy');
    });
  };

  $scope.cancel = () => {
    $uibModalInstance.dismiss('');
    $scope.trade = null;
  };

  $scope.close = (acct) => {
    Alerts.confirm('ARE_YOU_SURE_CANCEL', {}, '', 'IM_DONE', {}).then(() => {
      if (acct) $scope.initExchangeAcct();
      $scope.cancel();
    });
  };

  if ($scope.trade) $scope.nextStep();

  $scope.isCurrencySelected = (currency) => currency === $scope.transaction.currency;

  $scope.$watch('method', $scope.updateAmounts);
  $scope.$watch('transaction.fiat', $scope.getQuote);
  $scope.$watchGroup(['exchange.user', 'user.isEmailVerified'], $scope.nextStep);

  $scope.$watch('transaction.currency', () => {
    let curr = $scope.transaction.currency || null;
    $scope.currencySymbol = currency.conversions[curr.code];
    $scope.getQuote();
  });

  $scope.$watch('step', () => {
    if (!$scope.partner) $scope.addExchange();
    if ($scope.exchange && $scope.exchange.user && !$scope.exchange.profile) $scope.fetchProfile();
  });

  $scope.initExchangeAcct = () => {
    $scope.userHasExchangeAcct = true;
    $rootScope.$broadcast('initExchangeAcct');
  };
}
