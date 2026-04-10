// types.ts

// Define interfaces for Scalping Bot

interface ScalpingStrategy {
    name: string;
    description: string;
    riskLevel: number;
    entryCriteria: string;
    exitCriteria: string;
}

interface Trade {
    id: string;
    pair: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    status: 'open' | 'closed';
    timestamp: Date;
}

interface ScalpingBot {
    strategies: ScalpingStrategy[];
    openTrades: Trade[];
    balance: number;
    addStrategy(strategy: ScalpingStrategy): void;
    executeTrade(trade: Trade): void;
    closeTrade(tradeId: string): void;
}