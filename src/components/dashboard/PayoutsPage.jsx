import { useState, useEffect } from "react";
import { getPayoutSchedule, getMemberPayout } from "../../lib/dataService.js";

export default function PayoutsPage({ user }) {
  const [payoutSchedule, setPayoutSchedule] = useState([]);
  const [myPayout, setMyPayout] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPayouts() {
      if (!user?.id) return;
      
      try {
        const [schedule, memberPayout] = await Promise.all([
          getPayoutSchedule(),
          getMemberPayout(user.id),
        ]);
        
        setPayoutSchedule(schedule);
        setMyPayout(memberPayout);
      } catch (error) {
        console.error("Error loading payouts:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPayouts();
  }, [user?.id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getPayoutStatus = (payout) => {
    const today = new Date();
    const payoutDate = new Date(payout.date);
    
    if (payout.status === "completed") return "Received";
    if (payoutDate < today) return "Received";
    if (payoutDate.toDateString() === today.toDateString()) return "Today";
    return "Pending";
  };

  if (loading) {
    return <div className="payouts-page loading">Loading payout schedule...</div>;
  }

  return (
    <div className="payouts-page">
      <div className="payouts-info">
        <div className="payout-highlight">
          <span className="payout-highlight-label">Your Turn</span>
          <span className="payout-highlight-value">#{myPayout?.cycle_number || "N/A"}</span>
        </div>
        <div className="payout-highlight">
          <span className="payout-highlight-label">Expected Date</span>
          <span className="payout-highlight-value">{formatDate(myPayout?.date)}</span>
        </div>
        <div className="payout-highlight">
          <span className="payout-highlight-label">Amount</span>
          <span className="payout-highlight-value">Ksh. {myPayout?.amount || 500}</span>
        </div>
      </div>

      <div className="payouts-table-wrap">
        {payoutSchedule.length > 0 ? (
        <table className="payouts-table">
          <thead>
            <tr>
              <th>Turn</th>
              <th>Member</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payoutSchedule.map((p) => {
              const isMe = p.member_id === user.id;
              const status = getPayoutStatus(p);
              return (
                <tr key={p.id} className={isMe ? "highlight-row" : ""}>
                  <td>#{p.cycle_number}</td>
                  <td>{isMe ? "You" : p.members?.name || "Member"}</td>
                  <td>{formatDate(p.date)}</td>
                  <td>
                    <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        ) : (
          <p className="no-data">No payout schedule available yet.</p>
        )}
      </div>
    </div>
  );
}
