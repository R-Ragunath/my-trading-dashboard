export interface ScalpingStrategyConfig {
    takeProfit: number;
    stopLoss: number;
    entryTimeFrame: string;
    exitTimeFrame: string;
    maximumDrawdown: number;
}

export const defaultScalpingStrategyConfig: ScalpingStrategyConfig = {
    takeProfit: 1.5,
    stopLoss: 0.5,
    entryTimeFrame: "5m",
    exitTimeFrame: "15m",
    maximumDrawdown: 10,
};