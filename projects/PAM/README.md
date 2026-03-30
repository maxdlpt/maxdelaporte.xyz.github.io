# Portfolio Allocation Model (PAM)

This document's purpose is to find the optimal allocation for any public equity portfolio of up to 30 assets based on the selected allocation method.

There are 4 allocation methods available:
>  - *Equally Weighted (EW)*
>  - *Inverse Volatility (IV)*
>  - *Equal Risk Contribution (ERC)*
>  - *Minimal Volatility (MinVol)*

The model is dynamic: automatically adapts to:
> - the number of assets ($n$)
> - the allocation method (*"DistMeth"*) .  
To make it as such, I relied heavily on `=IF()` and `=INDEX(MATCH(),MATCH())` functions. Which proved too complex for the Excel Solver in heavier calculations (*"ERC"* and *"MinVol"* weights).  
This is why the weight distributions for "ERC" and "MinVol" are each solved for in their own Python scripts.  

---

### How to Use

1. ***"Security Entry"* Worksheet**
   > Input the tickers of all public equity securities you want in the portfolio. Bloomberg functions extract key market statistics on these stocks.

2. ***"PX Data"* Worksheet**  
   > Retrieves the last 3 years of closing prices for the selected securities using Bloomberg. Daily performance of each stock over the period is calculated.

3. ***"GARCH Vol"* Worksheet**  
   > Calculates each stock's volatility using the GARCH method.  
   > - Two macro buttons are available in the upper-left corner:  
   >   1. Reset the α and β values of every security.  
   >   2. Copy the α and β values from the first asset to all others.

4. ***Matrixes Worksheet***  
   > Calculates and visualizes three matrices (useful for debugging and data analysis):  
   > - The portfolio's **Correlation Matrix**  
   > - Its **Variance-Covariance Matrix (Omega)**  
   > - The **Weighted Omega Matrix** (calculated as `Omega * Weights`, dynamically adjusted based on the chosen allocation method).

5. ***Portfolio Worksheet***
   > Outputs the weights of all inputted assets based on the selected allocation method (selectable via the "DistMeth" dropdown list in the upper-right corner).
   > - Calculates portfolio volatility and the Marginal Risk Contribution (%) of each asset.
   > - For **ERC** or **MinVol** methods:
   > Click the macro button in the upper-left corner of the worksheet to execute the appropriate solver (`ERC_Solver.exe` or `MinVol_Solver.exe`) for weight distribution calculations.

---

### Installation & Distribution

PAM ships as a self-contained package with **no Python installation required** on the recipient's machine.

**Required files (keep all three in the same folder):**
- `PORTFOLIO ALLOCATION MODEL.xlsm` — Excel workbook (enable macros when prompted)
- `ERC_Solver.exe` — Standalone solver for Equal Risk Contribution allocation
- `MinVol_Solver.exe` — Standalone solver for Minimum Volatility allocation

Just distribute these three files together. The `.exe` files bundle Python and all dependencies internally (~150–250 MB each).

---

### Dependencies

- *Excel*
  > Microsoft Excel with **macros enabled** when prompted. VBA macros orchestrate the solver calls.

- *Bloomberg Terminal Open*
  > Access to bloomberg is also needed, unless you have another way to input the closing prices of the past 750 working days for every security. If not, the prices and tickers already present on the document serve as a demo.
- *Excel VBA Macros* (must be enabled) 
  > - To reset or apply α and β values.  
  > - To run Python scripts for ERC and MinVol.
- Enable *Automatic Formulas*
- There are notes scattered throughout the Excel Doc to help with potential errors.

---
