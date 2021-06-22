SE = {
    User: null,
    Params: {},
    Tokens: [],
    ScotTokens: {},
    Settings: {},
    web3: {},
    EthWithdrawalFee: 0,
    BnbWithdrawalFee: 0,
    ABI: [{
        constant: true,
        inputs: [{ name: '_owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: 'balance', type: 'uint256' }],
        type: 'function'
    }, {
        constant: true,
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        type: 'function'
    }, {
        constant: false,
        inputs: [{ name: '_to', type: 'address' }, { name: '_value', type: 'uint256' }],
        name: 'transfer',
        outputs: [{ name: '', type: 'bool' }
        ],
        type: 'function'
    }],
    ERC20Tokens: [],
    BEP20Tokens: [],
    EthFeeBalance: 0,
    BnbFeeBalance: 0,

    Api: function(url, data, callback, always) {
        if (data == null || data == undefined) data = {};

        // Add a dummy timestamp parameter to prevent IE from caching the requests.
        data.v = new Date().getTime();

        jQuery
            .getJSON(Config.ACCOUNTS_API_URL + url, data, function(response) {
                if (callback != null && callback != undefined) callback(response);
            })
            .always(function() {
                if (always) always();
            });
    },

    ShowHomeView: function(view, data, url_params) {
        window.scrollTo(0, 0);
        $('body').css('overflow', 'auto');
        $('body').css('padding-right', '0');

        if (Config.MAINTENANCE_MODE)
            view = 'maintenance';

        $('#page_container').html(render(view, { data: data }));

        SE.LastView = SE.CurrentView;
        SE.CurrentView = { view: view, data: data };

        // Collapse the nav bar hamburger menu on mobile devices
        if (window.innerWidth <= 990) {
            var burger = $('.navbar-toggle');
            if (!burger.hasClass('collapsed'))
                burger.click();
        }

        if (view != 'home') {
            var url = '?p=' + view + (url_params ? '&' + $.param(url_params) : '');

            if (window.location.search == url)
                window.history.replaceState({ data: data, view: view, params: url_params }, 'Hive Engine - Smart Contracts on the HIVE blockchain', url);
            else
                window.history.pushState({ data: data, view: view, params: url_params }, 'Hive Engine - Smart Contracts on the HIVE blockchain', url);
        }
    },

    ShowDialog: function(dialog, data) {
        $('#dialog_container').html(renderDialog(dialog, data));
        $('#dialog_container').modal('show');
    },

    ShowUrlPage(url) {
        var parts = JSON.parse('{"' + decodeURI(url).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}');

        if (!parts.p) {
            SE.ShowHome();
            return;
        }

        switch (parts.p) {
            case 'balances':
                SE.ShowBalances(parts.a ? parts.a : SE.User.name);
                break;
            case 'rewards':
                SE.ShowRewards(parts.a ? parts.a : SE.User.name);
                break;
            case 'open_orders':
                SE.ShowOpenOrders(parts.a ? parts.a : SE.User.name);
                break;
            case 'tokens':
                SE.ShowTokens();
                break;
            case 'history':
                if (SE.User || parts.a) {
                    SE.LoadBalances(parts.a ? parts.a : SE.User.name, () => {
                        if (parts.t && SE.Tokens.find(t => t.symbol == parts.t))
                            SE.ShowHistory(parts.t);
                        else
                            SE.ShowTokens();
                    });
                } else
                    SE.ShowTokens();
                break;
            case 'pending_unstakes':
                SE.LoadPendingUnstakes(SE.User.name, () => {
                    SE.ShowPendingUnstakes();
                });
                break;
            case 'pending_undelegations':
                SE.LoadPendingUndelegations(SE.User.name, () => {
                    SE.ShowPendingUndelegations();
                });
                break;
            case 'add_token':
                SE.ShowAddToken();
                break;
                pending_unstakes
            case 'faq':
                SE.ShowFAQ();
                break;
            case 'market':
                SE.ShowMarket(parts.t);
                break;
            case 'conversion_history':
                SE.ShowConversionHistory();
                break;
            default:
                SE.ShowHome();
                break;
        }
    },

    HideDialog: function(viewToShowAfter, data) {
        $('#dialog_container').modal('hide');
        if (viewToShowAfter)
            SE.ShowHomeView(viewToShowAfter, data);
    },

    ShowDialogOpaque: function(dialog, data) {
        $('#dialog_container').html(renderDialog(dialog, data));
        $('#dialog_container').modal('show');
        $('.modal-backdrop').addClass('modal-backdrop-opaque');
    },

    ShowHome: function() {
        SE.ShowHomeView('home');
    },

    _loading: null,
    ShowLoading: function() {
        SE._loading = $('<div class="modal-backdrop fade show loading-backdrop" />');
        SE._loading.append(
            $(
                '<img src="https://s3.amazonaws.com/steemmonsters/website/loading.gif" class="loading" />'
            )
        );
        SE._loading.appendTo('body');
    },

    HideLoading: function() {
        SE._loading.remove();
    },

    ShowToast: function(isSuccess, message) {
        var toast = $(renderComponent("toast", { isSuccess: isSuccess, message: message }));
        $('#toast_container').append(toast);
        toast.toast('show');
    },

    ShowTokens: function() {
        SE.LoadTokens(r => SE.ShowHomeView('tokens', r));
    },

    ShowMarket: function(token) {
        if (!token)
            token = Config.NATIVE_TOKEN;

        SE.LoadTokens(r => SE.ShowHomeView('market', { selected: token }, { t: token }));
    },

    ShowMarketView: function(symbol, account) {
        SE.ShowLoading();

        if (symbol == Config.PEGGED_TOKEN)
            symbol = Config.NATIVE_TOKEN;

        if (!account && SE.User)
            account = SE.User.name;

        var token = SE.GetToken(symbol);

        if (token.metadata && token.metadata.hide_in_market) {
            SE.HideLoading();
            $('#market_view').html(render('components/not_available'));
            return;
        }

        let precision = token.precision

        let tasks = [];
        tasks.push(ssc.find('market', 'buyBook', { symbol: symbol }, 200, 0, [{ index: 'priceDec', descending: true }], false));
        tasks.push(ssc.find('market', 'sellBook', { symbol: symbol }, 200, 0, [{ index: 'priceDec', descending: false }], false));
        tasks.push(ssc.find('market', 'tradesHistory', { symbol: symbol }, 30, 0, [{ index: '_id', descending: true }], false));                       

        let marketHistoryGet = Config.HISTORY_API + 'marketHistory?symbol=' + symbol;        
        tasks.push($.get(marketHistoryGet));

        if (account) {
            tasks.push(ssc.find('market', 'buyBook', { symbol: symbol, account: account }, 100, 0, [{ index: '_id', descending: true }], false));
            tasks.push(ssc.find('market', 'sellBook', { symbol: symbol, account: account }, 100, 0, [{ index: '_id', descending: true }], false));
            tasks.push(ssc.find('tokens', 'balances', { account: account, symbol: { '$in': [symbol, 'SWAP.HIVE'] } }, 2, 0, '', false));
        }
        
        Promise.all(tasks).then(results => {
            // prepare buy orders
            var buy_total = 0;
            let buy_orders = results[0].map(o => {
                buy_total += o.quantity * o.price;
                o.total = buy_total;
                o.amountLocked = o.quantity * o.price;
                return o;
            });
            // prepare sell orders
            var sell_total = 0;
            let sell_orders = results[1].map(o => {
                sell_total += o.quantity * o.price;
                o.total = sell_total;
                o.amountLocked = o.quantity * o.price;
                return o;
            });
            // prepare trade history
            let trade_history = results[2].map(o => {
                o.total = o.price * o.quantity;
                o.timestamp_string = moment.unix(o.timestamp).format('YYYY-M-DD HH:mm:ss');
                return o;
            });

            const limitCandleStick = 60;            
            let market_history = results[3].slice(0, limitCandleStick).map(x => {
                return {
                    t: moment.unix(x.timestamp).format('YYYY-MM-DD HH:mm:ss'), //x.timestamp * 1000,
                    o: x.openPrice,
                    h: x.highestPrice,
                    l: x.lowestPrice,
                    c: x.closePrice,
                }
            });
            
            let user_orders = [];
            let user_token_balance = null;
            let user_hive_balance = null;
            if (account) {
                // prepare user orders and balance
                let user_buy_orders = results[4].map(o => {
                    o.type = 'buy';
                    o.total = o.price * o.quantity;
                    o.timestamp_string = moment.unix(o.timestamp).format('YYYY-M-DD HH:mm:ss');
                    return o;
                });
                let user_sell_orders = results[5].map(o => {
                    o.type = 'sell';
                    o.total = o.price * o.quantity;
                    o.timestamp_string = moment.unix(o.timestamp).format('YYYY-M-DD HH:mm:ss');
                    return o;
                });
                user_orders = user_buy_orders.concat(user_sell_orders);
                user_orders.sort((a, b) => b.timestamp - a.timestamp);

                user_token_balance = _.find(results[6], (balance) => balance.symbol === symbol);
                user_hive_balance = _.find(results[6], (balance) => balance.symbol === 'SWAP.HIVE');
            }

            $('#market_view').html(render('market_view', {
                data: {
                    token: symbol,
                    precision: precision,
                    buy_orders: buy_orders,
                    sell_orders: sell_orders,
                    trade_history: trade_history,
                    market_history: market_history,
                    user_orders: user_orders,
                    user_token_balance: user_token_balance,
                    user_hive_balance: user_hive_balance
                }
            }));

            SE.HideLoading();
        }, error => {
            SE.HideLoading();
            SE.ShowToast(false, 'Error retrieving market data.');
        });
    },

    ShowMarketOrderDialog: function(type, symbol, quantity, price) {
        SE.ShowDialogOpaque('confirm_market_order', { type: type, symbol: symbol, quantity: quantity, price: price });
    },

    ShowMarketCancelDialog: function(type, orderId, symbol, origin = 'market') {
        SE.ShowDialogOpaque('confirm_market_cancel', { type: type, orderId: orderId, symbol: symbol, origin: origin });
    },

    ShowMarketCancelSelectedDialog: function (orders, origin = 'market') {
        SE.ShowDialogOpaque('confirm_market_cancel_selected', { orders: orders, origin: origin });
    },

    SendMarketOrder: function(type, symbol, quantity, price) {
        if (type !== 'buy' && type !== 'sell') {
            console.error('Invalid order type: ', type)
            return;
        }

        SE.ShowLoading();
        var username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        var transaction_data = {
            "contractName": "market",
            "contractAction": type,
            "contractPayload": {
                "symbol": symbol,
                "quantity": quantity,
                "price": price
            }
        };

        console.log('Broadcasting ' + type + ' order: ', JSON.stringify(transaction_data));

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), type.toUpperCase() + ' Order: ' + symbol, function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success)
                            SE.ShowToast(true, type.toUpperCase() + ' order placed for ' + quantity + ' ' + symbol + ' at ' + price)
                        else
                            SE.ShowToast(false, 'An error occurred submitting the order: ' + tx.error)

                        SE.HideLoading();
                        SE.HideDialog();
                        SE.LoadTokens(() => SE.ShowMarketView(symbol, SE.User.name));
                    });
                } else
                    SE.HideLoading();
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.LoadTokens(() => SE.ShowMarketView(symbol, SE.User.name));
            });
        }
    },

    SendCancelMarketOrderSelected: async function (orders, origin = 'market') {        
        let successCount = 0;
        let symbol = "";
        if (orders && orders.length > 0) {            
            SE.ShowLoading();

            var transaction_data = [];

            for (var i = 0; i < orders.length; i++) {
                let order = orders[i];
                let type = order.txType;
                let orderId = order.txId;
                symbol = order.symbol;

                transaction_data.push({
                    "contractName": "market",
                    "contractAction": "cancel",
                    "contractPayload": {
                        "type": type,
                        "id": orderId
                    }
                });
            }   

            let orderRes = await new Promise(function (resolve, reject) {
                var username = localStorage.getItem('username');

                if (!username) {
                    window.location.reload();
                    return;
                }

                console.log('Broadcasting cancel order: ', JSON.stringify(transaction_data));

                // the function is executed automatically when the promise is constructed
                if (useKeychain()) {
                    hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Cancel Orders', function (response) {                            
                        if (response.success && response.result) {
                            SE.ShowToast(true, 'Please wait until the transaction is verified.');
                                
                            let txId = response.result.id;

                            // check last transaction in case bulk cancellation
                            // transactions to check in engine sidechain have id's like: {txId}-0, {txId}-1, {txId}-2 etc.
                            if (orders.length > 1) {
                                txId = response.result.id + "-" + (orders.length-1).toString();
                            }
                            
                            SE.CheckTransaction(txId, 3, tx => {
                                if (tx.success) {
                                    SE.ShowToast(true, 'Cancel orders completed');
                                    resolve(true);
                                } else {
                                    SE.ShowToast(false, 'An error occurred cancelling the order: ' + tx.error)
                                    resolve(false);
                                }                                    
                            });
                        } else {
                            resolve(false);
                        }
                    });
                } else {
                    SE.ShowToast(false, 'Bulk cancellation is currently only supported in combination with Keychain.');
                    SE.HideLoading();
                    SE.HideDialog();
                }
            });       

            if (orderRes) {                    
                successCount++;                    
            }
            
            SE.HideLoading();
            SE.HideDialog();

            if (successCount > 0) {
                if (origin == 'open_orders') {
                    SE.ShowOpenOrders(SE.User.name);
                } else {
                    SE.ShowMarketView(symbol, SE.User.name);
                }
            }
        }
    },

    SendCancelMarketOrder: function(type, orderId, symbol, origin = 'market') {
        if (type !== 'buy' && type !== 'sell') {
            console.error('Invalid order type: ', type)
            return;
        }

        SE.ShowLoading();
        var username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        var transaction_data = {
            "contractName": "market",
            "contractAction": "cancel",
            "contractPayload": {
                "type": type,
                "id": orderId
            }
        };

        console.log('Broadcasting cancel order: ', JSON.stringify(transaction_data));

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Cancel ' + type.toUpperCase() + ' Order', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success) {
                            SE.ShowToast(true, 'Cancel order ' + orderId + ' completed');
                        } else {
                            SE.ShowToast(false, 'An error occurred cancelling the order: ' + tx.error)
                        }

                        SE.HideLoading();
                        SE.HideDialog();

                        if (origin == 'open_orders') {
                            SE.ShowOpenOrders(SE.User.name);
                        } else {
                            SE.ShowMarketView(symbol, SE.User.name);
                        }
                    });
                } else {
                    SE.HideLoading();
                }
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.ShowMarketView(symbol, SE.User.name);
            });
        }
    },

    LoadTokens: function(callback) {
        ssc.find('tokens', 'tokens', {}, 1000, 0, [], (err, result) => {
            SE.Tokens = result.filter(t => !Config.DISABLED_TOKENS.includes(t.symbol));

            ssc.find('market', 'metrics', {}, 1000, 0, '', false).then(async(metrics) => {
                for (var i = 0; i < SE.Tokens.length; i++) {
                    var token = SE.Tokens[i];

                    token.highestBid = 0;
                    token.lastPrice = 0;
                    token.lowestAsk = 0;
                    token.marketCap = 0;
                    token.volume = 0;
                    token.priceChangePercent = 0;
                    token.priceChangeSteem = 0;

                    token.metadata = tryParse(token.metadata);

                    if (!token.metadata) {
                        token.metadata = {};
                    }

                    Object.keys(token.metadata).forEach(key => token.metadata[key] = filterXSS(token.metadata[key]));

                    if (!metrics) {
                        return;
                    }

                    var metric = metrics.find(m => token.symbol == m.symbol);

                    if (metric) {
                        token.highestBid = parseFloat(metric.highestBid);
                        token.lastPrice = parseFloat(metric.lastPrice);
                        token.lowestAsk = parseFloat(metric.lowestAsk);
                        token.marketCap = token.lastPrice * token.circulatingSupply;

                        if (Date.now() / 1000 < metric.volumeExpiration)
                            token.volume = parseFloat(metric.volume);

                        if (Date.now() / 1000 < metric.lastDayPriceExpiration) {
                            token.priceChangePercent = parseFloat(metric.priceChangePercent);
                            token.priceChangeSteem = parseFloat(metric.priceChangeSteem);
                        }

                        if (token.symbol == 'AFIT') {
                            var afit_data = await ssc.find('market', 'tradesHistory', { symbol: 'AFIT' }, 100, 0, [{ index: '_id', descending: false }], false);
                            token.volume = afit_data.reduce((t, v) => t += parseFloat(v.price) * parseFloat(v.quantity), 0);
                        }
                    }

                    if (token.symbol == 'SWAP.HIVE')
                        token.lastPrice = 1;
                }

                SE.Tokens.sort((a, b) => {
                    return (b.volume > 0 ? b.volume : b.marketCap / 1000000000000) - (a.volume > 0 ? a.volume : a.marketCap / 1000000000000);
                });

                var hive_balance = await ssc.findOne('tokens', 'balances', { account: 'honey-swap', symbol: 'SWAP.HIVE' });

                if (hive_balance && hive_balance.balance) {
                    var token = SE.GetToken('SWAP.HIVE');
                    token.supply -= parseFloat(hive_balance.balance);
                    token.circulatingSupply -= parseFloat(hive_balance.balance);
                }

                if (callback)
                    callback(SE.Tokens);
            });
        });
    },

    ShowBalances: function(account) {
        if (!account && SE.User) {
            account = SE.User.name;
        }

        SE.LoadBalances(account, r => {
            SE.ShowHomeView('balances', { balances: r, account: account }, { a: account });
        });
    },

    ShowRewards: function(account) {
        if (!account && SE.User) {
            account = SE.User.name;
        }

        SE.GetScotUserTokens(account, scotTokens => {
            SE.ShowHomeView('rewards', { scotTokens: scotTokens, account: account }, { a: account });
        });
    },

    ShowOpenOrders: function(account) {
        if (!account && SE.User) {
            account = SE.User.name;
        }

        let tasks = [];

        if (account) {
            tasks.push(ssc.find('market', 'buyBook', { account: account }, 100, 0, [{ index: '_id', descending: true }], false));
            tasks.push(ssc.find('market', 'sellBook', { account: account }, 100, 0, [{ index: '_id', descending: true }], false));
        }
        
        Promise.all(tasks).then(results => {            
            let user_orders = [];
            let user_token_balance = null;
            let user_hive_balance = null;
            if (account) {
                // prepare user orders and balance
                let user_buy_orders = results[0].map(o => {
                    o.type = 'buy';
                    o.total = o.price * o.quantity;
                    o.timestamp_string = moment.unix(o.timestamp).format('YYYY-M-DD HH:mm:ss');
                    return o;
                });
                let user_sell_orders = results[1].map(o => {
                    o.type = 'sell';
                    o.total = o.price * o.quantity;
                    o.timestamp_string = moment.unix(o.timestamp).format('YYYY-M-DD HH:mm:ss');
                    return o;
                });
                user_orders = user_buy_orders.concat(user_sell_orders);
                user_orders.sort((a, b) => b.timestamp - a.timestamp);

                SE.ShowHomeView('open_orders', { orders: user_orders, account: account }, { a: account });    
                SE.HideLoading();
            }
        });
    },

    GetScotUserTokens: function(account, callback) {
        if (!account && SE.User) {
            account = SE.User.name;
        }

        if (!SE.User) {
            SE.User = {};
        }

        SE.User.ScotTokens = [];

        $.get(Config.SCOT_API + `@${account}`, { hive: 1, v: new Date().getTime() }, results => {
            if (results) {
                let mapped = [];

                for (const key in results) {
                    const config = results[key];

                    if (config.pending_token) {
                        mapped.push(config);
                    }
                }

                SE.User.ScotTokens = mapped;

                if (callback) {
                    callback(mapped);
                }
            }
        }).fail(() => {
            if (callback)
                callback([]);
        });
    },

    ClaimToken: function(symbol, amount) {
        SE.ShowLoading();

        const token = SE.Tokens.find(t => t.symbol === symbol);
        const username = SE.User.name;
        const factor = Math.pow(10, token.precision);
        const calculated = amount / factor;

        const claimData = {
            symbol
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, 'scot_claim_token', 'Posting', JSON.stringify(claimData), `Claim ${calculated} ${symbol.toUpperCase()} Tokens`, function(response) {
                if (response.success && response.result) {
                    SE.ShowToast(true, `${symbol.toUpperCase()} tokens claimed`);
                    SE.HideLoading();
                    SE.ShowRewards();
                } else {
                    SE.HideLoading();
                }
            });
        } else {
            SE.HiveSignerJsonId('posting', 'scot_claim_token', claimData, () => {
                SE.HideLoading();
                SE.ShowRewards();
            });
        }
    },

    ClaimAllTokens: function () {
        SE.ShowLoading();

        const username = SE.User.name;
        const scotTokens = SE.User.ScotTokens;
        
        if (scotTokens && scotTokens.length > 0) {
            let claimData = [];

            for (let st of scotTokens) {
                var token = SE.Tokens.find(t => t.symbol === st.symbol);

                if (!token) {
                    continue;
                }

                if (st.pending_token > 0) {
                    claimData.push({ "symbol": st.symbol });
                }
            }

            if (claimData.length > 0) {
                if (useKeychain()) {
                    hive_keychain.requestCustomJson(username, 'scot_claim_token', 'Posting', JSON.stringify(claimData), `Claim All Tokens`, function (response) {
                        if (response.success && response.result) {
                            SE.ShowToast(true, `All tokens claimed`);
                            SE.HideLoading();
                            SE.ShowRewards();
                        } else {
                            SE.HideLoading();
                        }
                    });
                } else {
                    SE.HiveSignerJsonId('posting', 'scot_claim_token', claimData, () => {
                        SE.HideLoading();
                        SE.ShowRewards();
                    });
                }
            }
        } else {
            SE.HideLoading();
        }                
    },

    EnableStaking: function(symbol, unstakingCooldown, numberTransactions) {
        SE.ShowLoading();

        const username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        const transaction_data = {
            "contractName": "tokens",
            "contractAction": "enableStaking",
            "contractPayload": {
                "symbol": symbol,
                "unstakingCooldown": unstakingCooldown,
                "numberTransactions": numberTransactions
            }
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Enable Token Staking', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success) {
                            SE.ShowToast(true, 'Token staking enabled!');
                            window.location.reload();
                        } else {
                            SE.ShowToast(false, 'An error occurred attempting to enable staking on your token: ' + tx.error);
                        }

                        SE.HideLoading();
                        SE.HideDialog();
                    });
                } else {
                    SE.HideLoading();
                }
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.HideLoading();
                SE.HideDialog();
            });
        }
    },

    Stake: function(symbol, quantity, to) {
        SE.ShowLoading();

        const username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        const transaction_data = {
            "contractName": "tokens",
            "contractAction": "stake",
            "contractPayload": {
                "to": to,
                "symbol": symbol,
                "quantity": quantity
            }
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Stake Token', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success) {
                            SE.ShowToast(true, 'Token successfully staked');
                            SE.ShowBalances(SE.User.name);
                        } else {
                            SE.ShowToast(false, 'An error occurred attempting to enable stake token: ' + tx.error);
                        }

                        SE.HideLoading();
                        SE.HideDialog();
                    });
                } else {
                    SE.HideLoading();
                }
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.ShowBalances(SE.User.name);
            });
        }
    },

    Unstake: function(symbol, quantity) {
        SE.ShowLoading();

        const username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        const transaction_data = {
            "contractName": "tokens",
            "contractAction": "unstake",
            "contractPayload": {
                "symbol": symbol,
                "quantity": quantity
            }
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Stake Token', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success) {
                            SE.ShowToast(true, 'Token successfully staked');
                        } else {
                            SE.ShowToast(false, 'An error occurred attempting to enable stake token: ' + tx.error);
                        }

                        SE.HideLoading();
                        SE.HideDialog();
                    });
                } else {
                    SE.HideLoading();
                }
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.HideLoading();
                SE.HideDialog();
            });
        }
    },

    CancelUnstake: function(txID) {
        SE.ShowLoading();

        const username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        const transaction_data = {
            "contractName": "tokens",
            "contractAction": "cancelUnstake",
            "contractPayload": {
                "txID": txID
            }
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Stake Token', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success) {
                            SE.ShowToast(true, 'Token unstaking successfully cancelled');
                            SE.ShowHomeView('pending_unstakes');
                        } else {
                            SE.ShowToast(false, 'An error occurred attempting to unstake tokens: ' + tx.error);
                        }

                        SE.HideLoading();
                        SE.HideDialog();
                    });
                } else {
                    SE.HideLoading();
                }
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.HideLoading();
                SE.HideDialog();
                SE.ShowHomeView('pending_unstakes');
            });
        }
    },

    EnableDelegation: function(symbol, undelegationCooldown) {
        SE.ShowLoading();

        const username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        const transaction_data = {
            "contractName": "tokens",
            "contractAction": "enableDelegation",
            "contractPayload": {
                "symbol": symbol,
                "undelegationCooldown": undelegationCooldown
            }
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Enable Token Delegation', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success) {
                            SE.ShowToast(true, 'Token delegation enabled!');
                            window.location.reload();
                        } else {
                            SE.ShowToast(false, 'An error occurred attempting to enable delegation on your token: ' + tx.error);
                        }

                        SE.HideLoading();
                        SE.HideDialog();
                    });
                } else {
                    SE.HideLoading();
                }
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.HideLoading();
                SE.HideDialog();
            });
        }
    },

    Delegate: function(symbol, quantity, to) {
        SE.ShowLoading();

        const username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        const transaction_data = {
            "contractName": "tokens",
            "contractAction": "delegate",
            "contractPayload": {
                "to": to,
                "symbol": symbol,
                "quantity": quantity
            }
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Delegate Token', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success) {
                            SE.ShowToast(true, 'Token successfully delegated');
                            SE.ShowBalances(SE.User.name);
                        } else {
                            SE.ShowToast(false, 'An error occurred attempting to delegate token: ' + tx.error);
                        }

                        SE.HideLoading();
                        SE.HideDialog();
                    });
                } else {
                    SE.HideLoading();
                }
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.ShowBalances(SE.User.name);
            });
        }
    },

    Undelegate: function(symbol, quantity, from) {
        SE.ShowLoading();

        const username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        const transaction_data = {
            "contractName": "tokens",
            "contractAction": "undelegate",
            "contractPayload": {
                "from": from,
                "symbol": symbol,
                "quantity": quantity
            }
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Undelegate Tokens', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success) {
                            SE.ShowToast(true, 'Token undelegated');
                        } else {
                            SE.ShowToast(false, 'An error occurred attempting to undelegate: ' + tx.error);
                        }

                        SE.HideLoading();
                        SE.HideDialog();
                    });
                } else {
                    SE.HideLoading();
                }
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.HideLoading();
                SE.HideDialog();
            });
        }
    },

    LoadParams: function(callback) {
        var loaded = 0;

        ssc.findOne('sscstore', 'params', {}, (err, result) => {
            if (result && !err)
                Object.assign(SE.Params, result);

            if (++loaded >= 3 && callback)
                callback();
        });

        ssc.findOne('tokens', 'params', {}, (err, result) => {
            if (result && !err)
                Object.assign(SE.Params, result);

            if (++loaded >= 3 && callback)
                callback();
        });

        loadSteemPrice(() => {
            if (++loaded >= 3 && callback)
                callback();
        });
    },

    LoadPendingUnstakes: function(account, callback) {
        ssc.find('tokens', 'pendingUnstakes', { account: account }, 1000, 0, '', false).then(r => {
            if (SE.User && account == SE.User.name) {
                SE.User.pendingUnstakes = r;
            }

            if (callback) {
                callback(r);
            }
        });
    },

    LoadPendingUndelegations: function(account, callback) {
        ssc.find('tokens', 'pendingUndelegations', { account: account }, 1000, 0, '', false).then(r => {
            if (SE.User && account == SE.User.name) {
                SE.User.pendingUndelegations = r;
            }

            if (callback) {
                callback(r);
            }
        });
    },

    LoadBalances: function(account, callback) {
        ssc.find('tokens', 'balances', { account: account }, 1000, 0, '', false).then(r => {
            if (SE.User && account == SE.User.name)
                SE.User.balances = r;

            if (callback)
                callback(r);
        });
    },

    GetBalance: function(token) {
        if (SE.User && SE.User.balances) {
            var token = SE.User.balances.find(b => b.symbol == token);
            return token ? parseFloat(token.balance) : 0;
        } else
            return 0;
    },

    ShowHistory: function(symbol, name) {
        var token = SE.GetToken(symbol);
        SE.ShowHomeView('history', token, { t: symbol });
    },

    ShowPendingUnstakes: function() {
        SE.ShowHomeView('pending_unstakes');
    },

    ShowPendingUndelegations: function() {
        SE.ShowHomeView('pending_undelegations');
    },

    ShowAbout: function() {
        SE.ShowHomeView('about');
    },

    ShowConversionHistory: function() {
        $.get('https://converter-api.hive-engine.com/api/conversions/', { limit: 20, offset: 0, deposit__from_account: SE.User.name }, from_result => {
            $.get('https://converter-api.hive-engine.com/api/conversions/', { limit: 20, offset: 0, to_address: SE.User.name }, to_result => {
                var to_results = to_result.results.map(r => {
                    return {
                        coin_symbol: r.from_coin_symbol,
                        created_at: r.created_at,
                        amount: parseFloat(r.to_amount) + parseFloat(r.ex_fee),
                        to_address: r.to_memo.substr(r.to_memo.lastIndexOf(' ') + 1),
                        txid: r.to_txid,
                        ex_fee: r.ex_fee
                    }
                });

                var from_results = from_result.results.map(r => {
                    return {
                        coin_symbol: r.from_coin_symbol,
                        created_at: r.created_at,
                        amount: parseFloat(r.to_amount) + parseFloat(r.ex_fee),
                        to_address: r.to_address,
                        txid: r.to_txid,
                        ex_fee: r.ex_fee
                    }
                });

                var list = from_results.concat(to_results);
                list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                SE.ShowHomeView('conversion_history', list);
            });
        });
    },

    ShowFAQ: function() {
        SE.ShowHomeView('faq');
    },

    ShowRegister: function() {
        SE.ShowHomeView('register', localStorage.getItem('username'));
    },

    ShowSignIn: function() {
        SE.ShowHomeView('sign_in');
    },

    ShowAddToken: function() {
        SE.ShowHomeView('add_token');
    },

    ShowConfirmAddToken: function(name, symbol, precision, maxSupply, url) {
        SE.ShowDialogOpaque('confirm_add_token', {
            "name": name,
            "symbol": symbol,
            "precision": precision,
            "maxSupply": maxSupply,
            "url": url,
        });
    },

    OnLogin: function(username, callback) {
        SE.ShowLoading();
        SE.User = { name: username };
        $("#btnSignIn").hide();
        $("#lnkUsername").html(`@${username}`);
        let explorerLink = $(".explorer-link").attr("href");
        $(".explorer-link").attr("href", explorerLink + `@${username}`);
        $("#ddlLoggedIn").show();
        $('#nav_wallet').show();

        // Load the steem account info
        hive.api.getAccounts([username], (e, r) => {
            if (r && !e && r.length > 0)
                SE.User.account = r[0];
        });

        SE.LoadBalances(username);
        SE.LoadPendingUnstakes(username);
        SE.LoadPendingUndelegations(username);

        SE.GetScotUserTokens(username, scotTokens => {            
            if (scotTokens.length) {
                var rewardCount = scotTokens.length;
                for (let st of scotTokens) {
                    var token = SE.Tokens.find(t => t.symbol === st.symbol);

                    if (!token) {
                        rewardCount--;
                    }
                }

                if (rewardCount > 0)
                    $("#lnkUsername").html(`@${username} <span class="badge rewards">${rewardCount}</span>`);
            }
        });

        if (callback) {
            callback(SE.User);
        }
    },

    LogIn: function(username, key) {
        SE.ShowLoading();

        if (window.hive_keychain && !key) {
            hive_keychain.requestSignBuffer(username, 'Log In', 'Posting', function(response) {
                if (response.error) {
                    SE.HideLoading();
                    SE.ShowToast(false, 'Unable to log in with the @' + username + ' account.');
                } else {
                    localStorage.setItem('username', username);
                    window.location.reload();
                }
            });
        } else {
            try {
                if (key && !hive.auth.isWif(key)) {
                    key = hive.auth.getPrivateKeys(username, key, ['posting']).posting;
                }
            } catch (err) {
                SE.ShowToast(false, 'Invalid private key or master password.');
                return;
            }

            hive.api.getAccounts([username], function (e, r) {
                console.log(r);
                if (r && r.length > 0) {                    
                    try {
                        if (hive.auth.wifToPublic(key) == r[0].memo_key || hive.auth.wifToPublic(key) == r[0].posting.key_auths[0][0]) {
                            localStorage.setItem('username', username);
                            window.location.reload();
                        } else {
                            SE.HideLoading();
                            SE.ShowToast(false, 'Unable to log in with the @' + username + ' account. Invalid private key or password.');
                        }
                    } catch (err) {
                        SE.HideLoading();
                        SE.ShowToast(false, 'Unable to log in with the @' + username + ' account. Invalid private key or password.');
                    }
                } else {
                    SE.ShowToast(false, 'There was an error loading the @' + username + ' account.');
                }
            });
        }
    },

    LogOut: function() {
        localStorage.clear();
        SE.User = null;
        window.location.href = window.location.origin;
    },

    CheckRegistration: function(username, callback) {
        ssc.findOne('accounts', 'accounts', { id: username }, (err, result) => { if (callback) callback(result); });
    },

    CheckRegistrationStatus: function(interval = 5, retries = 5, callback) {
        var username = localStorage.getItem('username');
        console.log('Checking registration status: ' + username);

        SE.CheckRegistration(username, r => {
            if (r) {
                if (callback) callback(r);
            } else {
                if (retries > 0) {
                    console.log("Retrying...");
                    setTimeout(function() {
                        SE.CheckRegistrationStatus(interval, retries - 1, callback);
                    }, interval * 1000);
                } else {
                    //alert("Registration not found for @" + username + "\nPlease check again later.");
                }
            }
        });
    },

    UpdateTokenMetadata: function(symbol, metadata) {
        SE.ShowLoading();
        var username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        var transaction_data = {
            "contractName": "tokens",
            "contractAction": "updateMetadata",
            "contractPayload": {
                "symbol": symbol,
                "metadata": metadata
            }
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Update Token Metadata', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success)
                            SE.ShowToast(true, 'Token updated successfully!');
                        else
                            SE.ShowToast(false, 'An error occurred updating your token: ' + tx.error);

                        SE.HideLoading();
                        SE.HideDialog();
                        SE.LoadTokens(() => SE.ShowHistory(symbol));
                    });
                } else
                    SE.HideLoading()
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.LoadTokens(() => SE.ShowHistory(symbol));
            });
        }
    },

    UpdateTokenPrecision: function(symbol, precision) {
        SE.ShowLoading();

        const username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        var transaction_data = {
            "contractName": "tokens",
            "contractAction": "updatePrecision",
            "contractPayload": {
                "symbol": symbol,
                "precision": precision
            }
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Update Token Prevision', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success) {
                            SE.ShowToast(true, 'Token updated successfully!');
                        } else {
                            SE.ShowToast(false, 'An error occurred updating your token: ' + tx.error);
                            SE.HideLoading();
                            SE.HideDialog();
                            SE.LoadTokens(() => SE.ShowHistory(symbol));
                        }
                    });
                } else {
                    SE.HideLoading();
                }
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.LoadTokens(() => SE.ShowHistory(symbol));
            });
        }
    },

    RegisterToken: function(name, symbol, precision, maxSupply, url) {
        SE.ShowLoading();
        var username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        var registration_data = {
            "contractName": "tokens",
            "contractAction": "create",
            "contractPayload": {
                "symbol": symbol,
                "name": name,
                "precision": precision,
                "maxSupply": maxSupply
            }
        };

        if (url)
            registration_data.contractPayload.url = url;

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(registration_data), 'Hive Engine Token Registration', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success)
                            SE.ShowToast(true, 'Token created successfully!');
                        else
                            SE.ShowToast(false, 'An error occurred creating your token: ' + tx.error);

                        SE.HideLoading();
                        SE.HideDialog();
                        SE.LoadTokens(() => SE.ShowHistory(symbol));
                    });
                } else
                    SE.HideLoading()
            });
        } else {
            SE.HiveSignerJson('active', registration_data, () => {
                SE.LoadTokens(() => SE.ShowHistory(symbol));
            });
        }
    },

    ShowIssueTokenDialog: function(symbol, balance) {
        SE.ShowDialog('issue_token', { symbol: symbol, balance: balance });
    },

    IssueToken: function(symbol, to, quantity) {
        SE.ShowLoading();
        var username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        var transaction_data = {
            "contractName": "tokens",
            "contractAction": "issue",
            "contractPayload": {
                "symbol": symbol,
                "to": to,
                "quantity": quantity
            }
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Token Issue: ' + symbol, function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success)
                            SE.ShowToast(true, quantity + ' ' + symbol + ' tokens issued to @' + to);
                        else
                            SE.ShowToast(false, 'An error occurred issuing tokens: ' + tx.error);

                        SE.HideLoading();
                        SE.HideDialog();
                        SE.LoadTokens(() => SE.LoadBalances(SE.User.name, () => SE.ShowHistory(symbol)));
                    });
                } else
                    SE.HideLoading();
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.LoadTokens(() => SE.LoadBalances(SE.User.name, () => SE.ShowHistory(symbol)));
            });
        }
    },

    ShowSendTokenDialog: function(symbol, balance) {
        SE.ShowDialog('send_token', { symbol: filterXSS(symbol), balance: filterXSS(balance) });
    },

    ShowStakeDialog: function(symbol, balance) {
        SE.ShowDialog('stake_token', { symbol: filterXSS(symbol), balance: filterXSS(balance) });
    },

    ShowUnstakeDialog: function(symbol, staked) {
        SE.ShowDialog('unstake_token', { symbol: filterXSS(symbol), balance: filterXSS(staked) });
    },

    ShowEnableStakeDialog: function(symbol) {
        SE.ShowDialog('stake_token_enable', { symbol: filterXSS(symbol) });
    },

    ShowDelegateDialog: function(symbol, balance) {
        SE.ShowDialog('delegate_token', { symbol: symbol, balance: filterXSS(balance) });
    },

    ShowUndelegateDialog: function(symbol, staked) {
        SE.ShowDialog('undelegate_token', { symbol: symbol, balance: filterXSS(staked) });
    },

    ShowEnableDelegationDialog: function(symbol) {
        SE.ShowDialog('token_delegation_enable', { symbol: filterXSS(symbol) });
    },

    SendToken: function(symbol, to, quantity, memo) {
        SE.ShowLoading();
        var username = localStorage.getItem('username');

        if (!username) {
            window.location.reload();
            return;
        }

        var transaction_data = {
            "contractName": "tokens",
            "contractAction": "transfer",
            "contractPayload": {
                "symbol": symbol,
                "to": to,
                "quantity": quantity + '',
                "memo": memo
            }
        };

        console.log('SENDING: ' + symbol);

        if (useKeychain()) {
            hive_keychain.requestCustomJson(username, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Token Transfer: ' + symbol, function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success)
                            SE.ShowToast(true, quantity + ' ' + symbol + ' Tokens sent to @' + to)
                        else
                            SE.ShowToast(false, 'An error occurred submitting the transfer: ' + tx.error)

                        SE.HideLoading();
                        SE.HideDialog();
                        SE.LoadBalances(SE.User.name, () => SE.ShowHistory(symbol));
                    });
                } else
                    SE.HideLoading();
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.LoadBalances(SE.User.name, () => SE.ShowHistory(symbol));
            });
        }
    },

    ShowBuySSC: function() {
        SE.ShowDialog('buy_ssc', null);
    },

    BuySSC: function(amount) {
        SE.ShowLoading();

        if (!SE.User) {
            window.location.reload();
            return;
        }

        var transaction_data = {
            id: Config.CHAIN_ID,
            json: {
                "contractName": "sscstore",
                "contractAction": "buy",
                "contractPayload": {}
            }
        };

        if (useKeychain()) {
            hive_keychain.requestTransfer(SE.User.name, 'honey-swap', (amount).toFixedNoRounding(3), JSON.stringify(transaction_data), 'HIVE', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success) {
                            SE.ShowToast(true, 'Purchase transaction sent successfully.');
                            SE.HideLoading();
                            SE.HideDialog();
                            SE.LoadBalances(SE.User.name, () => SE.ShowHistory(Config.NATIVE_TOKEN, 'Hive Engine Tokens'));
                        } else
                            SE.ShowToast(false, 'An error occurred purchasing SSC: ' + tx.error);
                    });
                } else
                    SE.HideLoading();
            });
        } else {
            SE.HideLoading();
            SE.HiveSignerTransfer(SE.User.name, 'honey-swap', (amount).toFixedNoRounding(3) + ' HIVE', JSON.stringify(transaction_data), () => {
                SE.LoadBalances(SE.User.name, () => SE.ShowHistory(Config.NATIVE_TOKEN, 'Hive Engine Tokens'));
            });
        }
    },

    DepositSteem: function(amount) {
        SE.ShowLoading();

        if (!SE.User) {
            window.location.reload();
            return;
        }

        var transaction_data = {
            id: Config.CHAIN_ID,
            json: {
                "contractName": "hivepegged",
                "contractAction": "buy",
                "contractPayload": {}
            }
        };

        if (useKeychain()) {
            hive_keychain.requestTransfer(SE.User.name, Config.STEEMP_ACCOUNT, (amount).toFixedNoRounding(3), JSON.stringify(transaction_data), 'HIVE', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success) {
                            SE.ShowToast(true, 'Deposit transaction sent successfully.');
                            SE.HideLoading();
                            SE.HideDialog();
                            SE.LoadBalances(SE.User.name, () => SE.ShowMarket());
                        } else
                            SE.ShowToast(false, 'An error occurred depositing HIVE: ' + tx.error);
                    });
                } else
                    SE.HideLoading();
            });
        } else {
            SE.HideLoading();
            SE.HiveSignerTransfer(SE.User.name, Config.STEEMP_ACCOUNT, (amount).toFixedNoRounding(3) + ' HIVE', JSON.stringify(transaction_data), () => {
                SE.LoadBalances(SE.User.name, () => SE.ShowMarket());
            });
        }
    },

    WithdrawSteem: function(amount) {
        SE.ShowLoading();

        if (!SE.User) {
            window.location.reload();
            return;
        }

        var transaction_data = {
            "contractName": "hivepegged",
            "contractAction": "withdraw",
            "contractPayload": {
                "quantity": (amount).toFixedNoRounding(3)

            }
        };

        if (useKeychain()) {
            hive_keychain.requestCustomJson(SE.User.name, Config.CHAIN_ID, 'Active', JSON.stringify(transaction_data), 'Withdraw HIVE', function(response) {
                if (response.success && response.result) {
                    SE.CheckTransaction(response.result.id, 3, tx => {
                        if (tx.success)
                            SE.ShowToast(true, amount.toFixed(3) + ' SWAP.HIVE withdrawn to @' + SE.User.name);
                        else
                            SE.ShowToast(false, 'An error occurred submitting the transaction: ' + tx.error)

                        SE.HideLoading();
                        SE.HideDialog();
                        SE.LoadBalances(SE.User.name, () => SE.ShowMarket());
                    });
                } else
                    SE.HideLoading();
            });
        } else {
            SE.HiveSignerJson('active', transaction_data, () => {
                SE.LoadBalances(SE.User.name, () => SE.ShowMarket());
            });
        }
    },

    ShowTransactionDialog: function(data) {
        SE.ShowDialog('transaction', data);
    },

    _sc_callback: null,
    HiveSignerJson: function(auth_type, data, callback) {
        SE.HideLoading();
        SE.ShowDialog('hivesigner')

        var username = localStorage.getItem('username');
        var url = 'https://hivesigner.com/sign/custom-json?';

        if (auth_type == 'active') {
            url += 'required_posting_auths=' + encodeURI('[]');
            url += '&required_auths=' + encodeURI('["' + username + '"]');
            url += '&authority=active';
        } else
            url += 'required_posting_auths=' + encodeURI('["' + username + '"]');

        url += '&id=' + Config.CHAIN_ID;
        url += '&json=' + encodeURI(JSON.stringify(data));

        popupCenter(url, 'hivesigner', 500, 560);
        SE._sc_callback = callback;
    },

    HiveSignerJsonId: function(auth_type, id, data, callback) {
        SE.HideLoading();
        SE.ShowDialog('hivesigner')

        var username = localStorage.getItem('username');
        var url = 'https://hivesigner.com/sign/custom-json?';

        if (auth_type == 'active') {
            url += 'required_posting_auths=' + encodeURI('[]');
            url += '&required_auths=' + encodeURI('["' + username + '"]');
            url += '&authority=active';
        } else {
            url += 'required_posting_auths=' + encodeURI('["' + username + '"]');
        }

        url += '&id=' + id;
        url += '&json=' + encodeURI(JSON.stringify(data));

        popupCenter(url, 'hivesigner', 500, 560);
        SE._sc_callback = callback;
    },

    HiveSignerTransfer: function(from, to, amount, memo, callback) {
        SE.HideLoading();
        SE.ShowDialog('hivesigner')

        var url = 'https://hivesigner.com/sign/transfer?';
        url += '&from=' + encodeURI(from);
        url += '&to=' + encodeURI(to);
        url += '&amount=' + encodeURI(amount);
        url += '&memo=' + encodeURI(memo);

        popupCenter(url, 'hivesigner', 500, 560);
        SE._sc_callback = callback;
    },

    HiveSignerCallback: function() {
        if (SE._sc_callback) {
            SE.ShowLoading();

            setTimeout(() => {
                SE.HideLoading();
                SE._sc_callback();
                SE._sc_callback = null;
            }, 10000);
        }
    },

    CheckAccount: function(name, callback) {
        hive.api.getAccounts([name], (e, r) => {
            if (r && r.length > 0)
                callback(r[0]);
            else
                callback(null);
        });
    },

    CheckTransaction(trx_id, retries, callback) {
        ssc.getTransactionInfo(trx_id, (err, result) => {
            if (result) {
                var error = null;

                if (result.logs) {
                    var logs = JSON.parse(result.logs);

                    if (logs.errors && logs.errors.length > 0)
                        error = logs.errors[0];
                }

                if (callback)
                    callback(Object.assign(result, { error: error, success: !error }));
            } else if (retries > 0)
                setTimeout(() => SE.CheckTransaction(trx_id, retries - 1, callback), 5000);
            else if (callback)
                callback({ success: false, error: 'Transaction not found.' });
        });
    },

    GetToken: function(symbol) { return SE.Tokens.find(t => t.symbol == symbol); },

    GetDepositAddress: function(symbol, callback) {
        var pegged_token = Config.PEGGED_TOKENS.find(p => p.symbol == symbol);

        if (!pegged_token)
            return;

        $.ajax({
            url: Config.CONVERTER_API + '/convert/',
            type: 'POST',
            data: JSON.stringify({ from_coin: symbol, to_coin: pegged_token.pegged_token_symbol, destination: SE.User.name }),
            contentType: "application/json",
            dataType: "json",
            success: result => {
                if (callback)
                    callback(Object.assign(result, pegged_token));
            }
        });
    },

    GetWithdrawalAddress: function(symbol, address, memo, callback) {
        var pegged_token = Config.PEGGED_TOKENS.find(p => p.symbol == symbol);        

        if (!pegged_token)
            return;

        var dataToPost = { from_coin: pegged_token.pegged_token_symbol, to_coin: symbol, destination: address };        

        $.ajax({
            url: Config.CONVERTER_API + '/convert/',
            type: 'POST',
            data: JSON.stringify(dataToPost),
            contentType: "application/json",
            dataType: "json",
            error: (xhr, status, errorThrown) => {
                if (callback) {
                    callback(xhr, null);
                }
            },
            success: result => {
                if (memo)
                    result.memo = result.memo + ' ' + memo;

                if (callback)
                    callback(null, Object.assign(result, pegged_token));
            }
        });
    },

    fetchEthAddress: function (callback) {
        try {
            if (!this.Settings || !this.Settings.eth_bridge)
                this.fetchSettings();

            var pegged_token = Config.PEGGED_TOKENS.find(p => p.symbol == 'ETH');

            if (!pegged_token)
                return;
            let username = SE.User.name;
            $.ajax({
                url: Config.ETH_BRIDGE_API + '/utils/ethaddress/' + username,
                type: 'GET',
                contentType: "application/json",
                dataType: "json",
                success: result => {
                    if (callback)
                        callback(null, result);
                },
                error: (xhr, status, errorThrown) => {
                    if (callback) {
                        callback(xhr, null);
                    }
                }
            });            
        } catch (e) {
            console.log(e.message)
        }
    },

    addUpdateEthAddress: async function (ethAddress, callback) {
        if (!this.Settings || !this.Settings.eth_bridge)
            this.fetchSettings();

        let isValidEthAddr = SE.web3.utils.isAddress(ethAddress);
        if (isValidEthAddr) {
            try {
                let accountFound = false;

                const accounts = await ethereum.request({ method: 'eth_accounts' });
                accountFound = accounts.find(x => x === ethAddress);

                if (!accountFound) {
                    try {
                        SE.requestPermissionsWallet(ethAddress, callback, 'eth');
                    } catch (e) {
                        console.log(e)
                    }
                }

                if (accountFound) {
                    SE.addUpdateEthAddressTx(ethAddress, callback);
                }

            } catch (e) {
                console.log(e.message);
                SE.HideLoading();
            }
        } else {
            SE.ShowToast(false, 'Invalid ETH address');
            SE.HideLoading();
        }
    },
    addUpdateEthAddressTx: async function (ethAddress, callback) {
        let web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");
        web3.eth.defaultAccount = ethAddress;
        data = SE.web3.utils.fromUtf8(SE.User.name);
        let ethSig = await window.ethereum.request({
            method: 'personal_sign',
            params: [data, ethAddress]
        });

        const memo = JSON.stringify({
            id: this.Settings.eth_bridge.id,
            json: {
                ethereumAddress: ethAddress,
                signature: ethSig
            }
        })

        hive_keychain.requestTransfer(SE.User.name, this.Settings.eth_bridge.account, 0.001, memo, 'HIVE', function (response) {
            console.log(response);
            if (response.success && response.result) {
                SE.ShowToast(true, 'Transaction sent successfully.');
                if (callback)
                    callback(null, true);
            } else {
                SE.ShowToast(false, 'An error occurred while updating ETH address');
                if (callback)
                    callback(response, null);
            }
        });
    },

    fetchSettings: function () {
        $.ajax({
            url: Config.SETTINGS_API + '/settings',
            type: 'GET',
            contentType: "application/json",
            dataType: "json",
            success: result => {
                this.Settings = result;
            },
            error: (xhr, status, errorThrown) => {
                console.log(xhr);
            }
        });     
    },

    depositEth: async function (ethAddress, ethAmount) {
        if (!this.Settings || !this.Settings.eth_bridge)
            this.fetchSettings();

        try {
            let depositAddress = this.Settings.eth_bridge.gateway_address.toLowerCase();
            let ethVal = SE.web3.utils.toHex(SE.web3.utils.toWei(ethAmount.toString(), 'ether'));

            const transactionHash = await ethereum.request({
                method: 'eth_sendTransaction',
                params: [
                    {
                        from: ethAddress,
                        to: depositAddress,                        
                        value: ethVal
                    },
                ],
            });

            console.log(transactionHash);
            SE.ShowToast(true, 'Deposit initiated.');
        } catch (e) {
            console.log(e.message)
        }
    },

    getEthWithdrawalFee: function (callback) {
        $.ajax({
            url: Config.ETH_BRIDGE_API + '/utils/withdrawalfee',
            type: 'GET',
            contentType: "application/json",
            dataType: "json",
            success: result => {
                if (callback)
                    callback(null, result);
            },
            error: (xhr, status, errorThrown) => {
                callback(xhr, null);
            }
        });  
    },

    WithdrawEth: function (symbol, amount, address, callback) {
        SE.SendToken(symbol, this.Settings.eth_bridge.account, amount, address);
    },

    fetchSupportedERC20s: function (deposit, withdrawal, callback) {
        try {
            $.ajax({
                url: Config.ETH_BRIDGE_API + '/utils/tokens/erc20',
                type: 'GET',
                contentType: "application/json",
                dataType: "json",
                success: result => {
                    const tokens = result.data.filter((t) => {
                        if (typeof deposit === 'boolean') {
                            return t.depositEnabled === deposit
                        }

                        return t.withdrawEnabled === withdrawal
                    })
                    .map((t) => {
                        return {
                            name: t.name,
                            symbol: t.ethSymbol,
                            pegged_token_symbol: t.heSymbol,
                            contract_address: t.contractAddress,
                            he_precision: t.hePrecision,
                            eth_precision: t.ethPrecision
                        }
                    });

                    this.ERC20Tokens = tokens;

                    if (callback)
                        callback(null, tokens);
                    //console.log(tokens);
                    //return tokens;
                },
                error: (xhr, status, errorThrown) => {
                    callback(xhr, null);
                }
            });              
        } catch (e) {
            console.log(e.message)
        }
    },

    getERC20Balance: async function(contractAddress, walletAddress) {
        if (!walletAddress || !contractAddress) {
            return 0
        }

        let legacyWeb3 = new Web3(window.web3.currentProvider);
        const contract = new legacyWeb3.eth.Contract(SE.ABI, contractAddress)

        const [balance, decimals] = await Promise.all([
            contract.methods.balanceOf(walletAddress).call(),
            contract.methods.decimals().call()
        ])

        return Number(balance) / 10 ** decimals
    },
    depositERC20: async function (ethAddress, ethAmount, erc20Symbol) {
        if (!this.Settings || !this.Settings.eth_bridge)
            this.fetchSettings();

        try {
            let depositAddress = this.Settings.eth_bridge.gateway_address;
            this.loading = true

            const symbol = SE.ERC20Tokens.find(t => t.symbol === erc20Symbol)

            let legacyWeb3 = new Web3(window.web3.currentProvider);
            const contract = new legacyWeb3.eth.Contract(SE.ABI, symbol.contract_address)

            const value = window.Decimal(ethAmount * 10 ** symbol.eth_precision).toFixed();            

            await contract.methods.transfer(depositAddress, value).send({ from: ethAddress });
            
            SE.ShowToast(true, 'Deposit initiated.');
        } catch (e) {
            console.log(e.message)
        }
    },
    fetchFeeBalance: function(callback) {
        try {
            $.ajax({
                url: Config.ETH_BRIDGE_API + '/utils/feebalance/' + SE.User.name,
                type: 'GET',
                contentType: "application/json",
                dataType: "json",
                success: result => {
                    SE.EthFeeBalance = Number(result.data.balance);

                    if (callback)
                        callback(null, SE.EthFeeBalance);
                },
                error: (xhr, status, errorThrown) => {
                    console.log(xhr);
                    //callback(xhr, null);
                }
            });  
        } catch (e) {
            console.log(e)
        }
    },
    DepositGas: async function (amount) {
        SE.SendToken(this.Settings.eth_bridge.ethereum.pegged_token_symbol, this.Settings.eth_bridge.account, amount, 'fee');
    },
    GetTokenCreationFee: async function (callback) {
        let fee = 0;
        await ssc.find('tokens', 'params', {}, 20, 0, [], (err, result) => {
            if (result && result[0] && result[0].tokenCreationFee)
                fee = result[0].tokenCreationFee;

            if (callback)
                callback(null, fee);
        });
    },
    depositBnb: async function (bscAddress, bnbAmount) {
        if (!this.Settings || !this.Settings.bsc_bridge)
            this.fetchSettings();

        try {
            let depositAddress = this.Settings.bsc_bridge.gateway_address;
            let bnbVal = SE.web3.utils.toHex(SE.web3.utils.toWei(bnbAmount.toString(), 'ether'));

            const transactionHash = await ethereum.request({
                method: 'eth_sendTransaction',
                params: [
                    {
                        from: bscAddress,
                        to: depositAddress,
                        value: bnbVal
                    },
                ],
            });

            console.log(transactionHash);
            SE.ShowToast(true, 'Deposit initiated.');
        } catch (e) {
            console.log(e.message)
        }
    },
    fetchBscAddress: function (callback) {
        try {
            if (!this.Settings || !this.Settings.bsc_bridge)
                this.fetchSettings();

            var pegged_token = Config.PEGGED_TOKENS.find(p => p.symbol == 'BNB');

            if (!pegged_token)
                return;
            let username = SE.User.name;
            $.ajax({
                url: Config.BSC_BRIDGE_API + '/utils/bscaddress/' + username,
                type: 'GET',
                contentType: "application/json",
                dataType: "json",
                success: result => {
                    if (callback)
                        callback(null, result);
                },
                error: (xhr, status, errorThrown) => {
                    if (callback) {
                        callback(xhr, null);
                    }
                }
            });
        } catch (e) {
            console.log(e.message)
        }
    },

    addUpdateBscAddress: async function (bscAddress, callback) {
        if (!this.Settings || !this.Settings.bsc_bridge)
            this.fetchSettings();

        let isValidBscAddr = SE.web3.utils.isAddress(bscAddress);
        if (isValidBscAddr) {
            try {
                let accountFound = false;

                const accounts = await ethereum.request({ method: 'eth_accounts' });
                accountFound = accounts.find(x => x === bscAddress);

                if (!accountFound) {
                    try {
                        SE.requestPermissionsWallet(bscAddress, callback, 'bnb');
                    } catch (e) {
                        console.log(e)
                    }
                }

                if (accountFound) {
                    SE.addUpdateBscAddressTx(bscAddress, callback);
                }

            } catch (e) {
                console.log(e.message);
                SE.HideLoading();
            }
        } else {
            SE.ShowToast(false, 'Invalid BSC address');
            SE.HideLoading();
        }
    },
    addUpdateBscAddressTx: async function (bscAddress, callback) {        
        let web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");
        web3.eth.defaultAccount = bscAddress;
        data = SE.web3.utils.fromUtf8(SE.User.name);
        let bscSig = await window.ethereum.request({
            method: 'personal_sign',
            params: [data, bscAddress]
        });

        const memo = JSON.stringify({
            id: this.Settings.bsc_bridge.id,
            json: {
                bscAddress: bscAddress,
                signature: bscSig
            }
        })

        hive_keychain.requestTransfer(SE.User.name, this.Settings.bsc_bridge.account, 0.001, memo, 'HIVE', function (response) {
            console.log(response);
            if (response.success && response.result) {
                SE.ShowToast(true, 'Transaction sent successfully.');
                if (callback)
                    callback(null, true);
            } else {
                SE.ShowToast(false, 'An error occurred while updating BSC address');
                if (callback)
                    callback(response, null);
            }
        });
    },
    fetchSupportedBEP20s: function (deposit, withdrawal, callback) {
        try {
            $.ajax({
                url: Config.BSC_BRIDGE_API + '/utils/tokens/bep20',
                type: 'GET',
                contentType: "application/json",
                dataType: "json",
                success: result => {
                    const tokens = result.data.filter((t) => {
                        if (typeof deposit === 'boolean') {
                            return t.depositEnabled === deposit
                        }

                        return t.withdrawEnabled === withdrawal
                    })
                        .map((t) => {
                            return {
                                name: t.name,
                                symbol: t.bscSymbol,
                                pegged_token_symbol: t.heSymbol,
                                contract_address: t.contractAddress,
                                he_precision: t.hePrecision,
                                bsc_precision: t.bscPrecision
                            }
                        });

                    this.BEP20Tokens = tokens;

                    if (callback)
                        callback(null, tokens);
                    //console.log(tokens);
                    //return tokens;
                },
                error: (xhr, status, errorThrown) => {
                    callback(xhr, null);
                }
            });
        } catch (e) {
            console.log(e.message)
        }
    },

    getBEP20Balance: async function (contractAddress, walletAddress) {
        if (!walletAddress || !contractAddress) {
            return 0
        }

        let legacyWeb3 = new Web3(window.web3.currentProvider);
        const contract = new legacyWeb3.eth.Contract(SE.ABI, contractAddress)

        const [balance, decimals] = await Promise.all([
            contract.methods.balanceOf(walletAddress).call(),
            contract.methods.decimals().call()
        ])

        return Number(balance) / 10 ** decimals
    },
    depositBEP20: async function (bscAddress, bnbAmount, bep20Symbol) {
        if (!this.Settings || !this.Settings.bsc_bridge)
            this.fetchSettings();

        try {
            let depositAddress = this.Settings.bsc_bridge.gateway_address;
            this.loading = true

            const symbol = SE.BEP20Tokens.find(t => t.symbol === bep20Symbol)

            let legacyWeb3 = new Web3(window.web3.currentProvider);
            const contract = new legacyWeb3.eth.Contract(SE.ABI, symbol.contract_address)

            const value = window.Decimal(bnbAmount * 10 ** symbol.bsc_precision).toFixed();

            await contract.methods.transfer(depositAddress, value).send({ from: bscAddress });

            SE.ShowToast(true, 'Deposit initiated.');
        } catch (e) {
            console.log(e.message)
        }
    },
    fetchFeeBalanceBsc: function (callback) {
        try {
            $.ajax({
                url: Config.BSC_BRIDGE_API + '/utils/feebalance/' + SE.User.name,
                type: 'GET',
                contentType: "application/json",
                dataType: "json",
                success: result => {
                    SE.BnbFeeBalance = Number(result.data.balance);

                    if (callback)
                        callback(null, SE.BnbFeeBalance);
                },
                error: (xhr, status, errorThrown) => {
                    console.log(xhr);
                    //callback(xhr, null);
                }
            });
        } catch (e) {
            console.log(e)
        }
    },
    DepositGasBsc: async function (amount) {
        SE.SendToken(this.Settings.bsc_bridge.bnb.pegged_token_symbol, this.Settings.bsc_bridge.account, amount, 'fee');
    },
    getBnbWithdrawalFee: function (callback) {
        $.ajax({
            url: Config.BSC_BRIDGE_API + '/utils/withdrawalfee',
            type: 'GET',
            contentType: "application/json",
            dataType: "json",
            success: result => {
                if (callback)
                    callback(null, result);
            },
            error: (xhr, status, errorThrown) => {
                callback(xhr, null);
            }
        });
    },
    WithdrawBsc: function (symbol, amount, address, callback) {
        SE.SendToken(symbol, this.Settings.bsc_bridge.account, amount, address);
    },
    requestPermissionsWallet: function (addr, callback, baseToken) {
        ethereum
            .request({
                method: 'wallet_requestPermissions',
                params: [{ eth_accounts: { addr } }],
            })
            .then((permissions) => {
                const accountsPermission = permissions.find(
                    (permission) => permission.parentCapability === 'eth_accounts'
                );
                if (accountsPermission) {
                    console.log('eth_accounts permission successfully requested!');
                }

                if (baseToken == 'bnb')
                    SE.addUpdateBscAddressTx(addr, callback);
                else if (baseToken == 'eth')
                    SE.addUpdateEthAddressTx(addr, callback);
            })
            .catch((error) => {
                if (error.code === 4001) {
                    // EIP-1193 userRejectedRequest error
                    console.log('Permissions needed to continue.');
                } else {
                    console.error(error);
                }
            });
    }
}