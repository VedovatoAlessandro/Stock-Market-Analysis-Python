"""
Data Loader module for Stock Market Analysis.
Responsible for downloading, cleaning, validating, and formatting historical market data.

Author: Junior Quantitative Developer / Analyst Portfolio
"""

import os
import logging
from typing import List, Optional, Union
import datetime
import pandas as pd
import yfinance as yf

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("DataLoader")


class StockDataLoader:
    """
    Handles data ingestion from Yahoo Finance API.
    Provides sanitization and validation on historical stock pricing data.
    """

    def __init__(self, data_dir: str = "data"):
        """
        Initializes the StockDataLoader.
        
        Parameters:
            data_dir (str): Local directory to cache or save downloaded datasets.
        """
        self.data_dir = data_dir
        if not os.path.exists(data_dir):
            os.makedirs(data_dir)
            logger.info(f"Created local data directory: {data_dir}")

    def fetch_stock_data(
        self,
        tickers: Union[str, List[str]],
        start_date: Union[str, datetime.date],
        end_date: Union[str, datetime.date],
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Downloads historical stock data from yfinance.

        Parameters:
            tickers (str or list): One or more ticker symbols (e.g. 'AAPL', ['AAPL', 'MSFT']).
            start_date (str or date): Ingestion start date (YYYY-MM-DD format).
            end_date (str or date): Ingestion end date (YYYY-MM-DD format).
            interval (str): Frequency interval ('1d', '1wk', '1mo').

        Returns:
            pd.DataFrame: A cleaned DataFrame of stock prices, indexed by Date.
        """
        # Convert tickers to list if string
        if isinstance(tickers, str):
            tickers = [tickers.strip().upper()]
        else:
            tickers = [t.strip().upper() for t in tickers]

        # Ingestion Range Validation
        start_parsed = self._validate_date(start_date)
        end_parsed = self._validate_date(end_date)
        
        if start_parsed >= end_parsed:
            raise ValueError(f"Start date ({start_parsed}) must be prior to end date ({end_parsed}).")

        logger.info(f"Downloading historical data for: {tickers} from {start_parsed} to {end_parsed}")

        try:
            # Fetch using yfinance API
            # group_by='ticker' allows clean separation of multiple stock matrices
            raw_data = yf.download(
                tickers=" ".join(tickers),
                start=start_parsed.strftime("%Y-%m-%d"),
                end=end_parsed.strftime("%Y-%m-%d"),
                interval=interval,
                group_by="ticker" if len(tickers) > 1 else None,
                auto_adjust=True,
                progress=False
            )

            if raw_data.empty:
                logger.warning("No data retrieved from Yahoo Finance for selected tickers.")
                return pd.DataFrame()

            cleaned_df = self.clean_and_sanitize_data(raw_data, tickers)
            return cleaned_df

        except Exception as e:
            logger.error(f"Error fetching data from yfinance: {e}", exc_info=True)
            raise

    def clean_and_sanitize_data(self, df: pd.DataFrame, tickers: List[str]) -> pd.DataFrame:
        """
        Cleans the downloaded pricing data:
        - Checks for missing values and handles them via forward/backward fill
        - Removes duplicate rows
        - Flattens multi-level columns if present
        - Asserts date column formatting and index properties.

        Parameters:
            df (pd.DataFrame): Raw DataFrame downloaded from yfinance.
            tickers (list): List of tickers included in the download.

        Returns:
            pd.DataFrame: Cleaned and structured DataFrame.
        """
        # Create a deep copy to preserve raw data structures
        working_df = df.copy()

        # Remove duplicate index rows if any
        initial_len = len(working_df)
        working_df = working_df[~working_df.index.duplicated(keep="first")]
        dup_diff = initial_len - len(working_df)
        if dup_diff > 0:
            logger.info(f"Removed {dup_diff} duplicate date rows from the index.")

        # Address potential missing values (NaNs) in pricing lists
        # Forward fill first (representing carrying forward the last known price), 
        # then backward fill (for any starting NaNs)
        null_count = working_df.isnull().sum().sum()
        if null_count > 0:
            logger.warning(f"Detected {null_count} missing values. Performing forward/backward fill sanitization.")
            working_df = working_df.ffill().bfill()

        # Check for any remaining NaNs
        if working_df.isnull().sum().sum() > 0:
            logger.critical("DataFrame still contains missing values after filling. Proceeding with caution.")

        # Structure index and verify dates
        working_df.index = pd.to_datetime(working_df.index)
        working_df.index.name = "Date"

        logger.info(f"Data sanitation complete. Shape: {working_df.shape}")
        return working_df

    def save_to_csv(self, df: pd.DataFrame, filename: str) -> str:
        """
        Caches the clean DataFrame to CSV for offline access.
        """
        full_path = os.path.join(self.data_dir, filename)
        try:
            df.to_csv(full_path)
            logger.info(f"Saved dataset cache locally at: {full_path}")
            return full_path
        except Exception as e:
            logger.error(f"Failed to save CSV to {full_path}: {e}")
            raise

    def load_from_csv(self, filename: str) -> pd.DataFrame:
        """
        Retrieves cached data from a local CSV.
        """
        full_path = os.path.join(self.data_dir, filename)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"No local cache found at: {full_path}")
        
        logger.info(f"Loading local stock cache from: {full_path}")
        df = pd.read_csv(full_path, index_col="Date", parse_dates=True)
        return df

    @staticmethod
    def _validate_date(date_input: Union[str, datetime.date, datetime.datetime]) -> datetime.date:
        """
        Helper method to normalize and validate date formats.
        """
        if isinstance(date_input, (datetime.date, datetime.datetime)):
            if isinstance(date_input, datetime.datetime):
                return date_input.date()
            return date_input

        if isinstance(date_input, str):
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                try:
                    return datetime.datetime.strptime(date_input, fmt).date()
                except ValueError:
                    continue
            raise ValueError(f"Unable to parse date string '{date_input}'. Supported formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY.")

        raise TypeError("Date input must be a string, datetime.date, or datetime.datetime.")


# Simple testing harness
if __name__ == "__main__":
    loader = StockDataLoader()
    try:
        data = loader.fetch_stock_data("AAPL", "2025-01-01", "2025-12-31")
        print(data.head())
    except Exception as err:
        print(f"Test Execution Failed: {err}")
