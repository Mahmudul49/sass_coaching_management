"use client";
import { useState, useTransition } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import { useToast } from "@/components/providers/ToastProvider";
import { setAttendanceSms } from "@/app/[tenant]/admin/actions/settings";

export default function SettingsClient({
  centerName,
  attendanceSmsEnabled,
}: {
  centerName: string;
  attendanceSmsEnabled: boolean;
}) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(attendanceSmsEnabled);
  const [pending, start] = useTransition();

  function toggle(next: boolean) {
    setEnabled(next); // optimistic
    start(async () => {
      const res = await setAttendanceSms(next);
      if (res.ok) toast.success("সেটিংস সংরক্ষিত হয়েছে।");
      else {
        setEnabled(!next);
        toast.error(res.error ?? "সমস্যা হয়েছে।");
      }
    });
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="h6">{centerName}</Typography>
          <Typography variant="body2" color="text.secondary">
            সেন্টারের সেটিংস
          </Typography>
          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => toggle(e.target.checked)} disabled={pending} />}
            label="উপস্থিতির SMS চালু করুন"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            চালু থাকলে প্রতিদিন উপস্থিতি সংরক্ষণের সময় প্রতিটি ছাত্রকে SMS পাঠানো হবে।
          </Typography>

          <Alert severity="warning" sx={{ mt: 2 }}>
            অনেক ছাত্র থাকলে প্রতিদিন উপস্থিতির SMS খরচ অনেক বেড়ে যেতে পারে। তাই এটি
            ডিফল্টভাবে বন্ধ থাকে। পেমেন্টের SMS সবসময় চালু থাকে।
          </Alert>
        </CardContent>
      </Card>
    </Stack>
  );
}
